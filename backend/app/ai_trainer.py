import cv2
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
import mediapipe as mp
from pathlib import Path
import pyttsx3
from threading import Thread
import os

class PoseDetector:
    """Detects human pose using MediaPipe with high accuracy"""
    def __init__(self):
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=2,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.7
        )
        self.mp_draw = mp.solutions.drawing_utils
        
    def detect_pose(self, frame):
        """Detect pose landmarks from frame"""
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.pose.process(rgb)
        return results
    
    def get_angle(self, a, b, c):
        """Calculate angle between three points for form analysis"""
        a = np.array(a)
        b = np.array(b)
        c = np.array(c)
        
        radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
        angle = np.abs(radians*180.0/np.pi)
        
        if angle > 180.0:
            angle = 360-angle
            
        return angle

class ExerciseAnalyzer:
    """Analyzes exercises using dataset instructions and pose detection"""
    def __init__(self, exercises_csv_path: str):
        self.exercises_df = pd.read_csv(exercises_csv_path)
        self.exercises_df.columns = self.exercises_df.columns.str.strip().str.lower()
        self.current_exercise = None
        self.rep_count = 0
        self.stage = None
        self.feedback_messages = []
        
    def get_exercise_instructions(self, exercise_name: str) -> List[str]:
        """Get step-by-step instructions from dataset"""
        exercise = self.exercises_df[self.exercises_df['name'].str.lower().str.contains(exercise_name.lower(), na=False)]
        if exercise.empty:
            return []
        
        instructions = []
        for i in range(11):
            col = f'instructions/{i}'
            if col in exercise.columns:
                inst = exercise.iloc[0][col]
                if pd.notna(inst) and str(inst).strip():
                    instructions.append(str(inst).strip())
        return instructions
    
    def get_exercise_info(self, exercise_name: str) -> Dict:
        """Get complete exercise information from dataset"""
        exercise = self.exercises_df[self.exercises_df['name'].str.lower().str.contains(exercise_name.lower(), na=False)]
        if exercise.empty:
            return {}
        
        row = exercise.iloc[0]
        return {
            "name": row.get('name', ''),
            "body_part": row.get('bodypart', ''),
            "target": row.get('target', ''),
            "equipment": row.get('equipment', ''),
            "gif_url": row.get('gifurl', ''),
            "instructions": self.get_exercise_instructions(exercise_name)
        }
    
    def detect_exercise_from_pose(self, landmarks) -> Optional[str]:
        """Detect exercise type from pose landmarks with high accuracy"""
        if not landmarks:
            return None
        
        mp_pose = mp.solutions.pose.PoseLandmark
        
        # Get key landmarks
        left_shoulder = landmarks[mp_pose.LEFT_SHOULDER.value]
        right_shoulder = landmarks[mp_pose.RIGHT_SHOULDER.value]
        left_hip = landmarks[mp_pose.LEFT_HIP.value]
        right_hip = landmarks[mp_pose.RIGHT_HIP.value]
        left_knee = landmarks[mp_pose.LEFT_KNEE.value]
        right_knee = landmarks[mp_pose.RIGHT_KNEE.value]
        left_elbow = landmarks[mp_pose.LEFT_ELBOW.value]
        right_elbow = landmarks[mp_pose.RIGHT_ELBOW.value]
        
        # Calculate body orientation
        torso_angle = abs(left_shoulder.y - left_hip.y)
        
        # Detect push-up (horizontal body, arms bent)
        if torso_angle < 0.3 and left_shoulder.y > 0.5:
            return "push up"
        
        # Detect squat (vertical body, knees bent)
        if torso_angle > 0.3 and left_knee.y > left_hip.y:
            return "squat"
        
        # Detect sit-up (lying down, torso curling up)
        if left_shoulder.y < left_hip.y and abs(left_shoulder.x - left_hip.x) < 0.2:
            return "sit-up"
        
        # Detect plank (horizontal body, straight arms)
        if torso_angle < 0.2 and left_elbow.y > left_shoulder.y:
            return "plank"
        
        # Detect pull-up (arms overhead, pulling motion)
        if left_shoulder.y < 0.4 and left_elbow.y < left_shoulder.y:
            return "pull up"
            
        return None

class AITrainer:
    """AI Trainer with voice feedback and rep counting"""
    def __init__(self, exercises_csv_path: str):
        self.pose_detector = PoseDetector()
        self.analyzer = ExerciseAnalyzer(exercises_csv_path)
        self.tts_engine = pyttsx3.init()
        self.tts_engine.setProperty('rate', 150)
        self.tts_engine.setProperty('volume', 0.9)
        self.feedback_queue = []
        self.last_feedback_time = 0
        
    def speak(self, text: str):
        """Provide voice feedback asynchronously"""
        self.feedback_queue.append(text)
        Thread(target=self._speak_async, args=(text,), daemon=True).start()
    
    def _speak_async(self, text: str):
        """Async voice feedback"""
        try:
            self.tts_engine.say(text)
            self.tts_engine.runAndWait()
        except:
            pass
    
    def analyze_pushup(self, landmarks) -> Tuple[str, int]:
        """Analyze push-up form with detailed feedback"""
        mp_pose = mp.solutions.pose.PoseLandmark
        
        left_shoulder = [landmarks[mp_pose.LEFT_SHOULDER.value].x, landmarks[mp_pose.LEFT_SHOULDER.value].y]
        left_elbow = [landmarks[mp_pose.LEFT_ELBOW.value].x, landmarks[mp_pose.LEFT_ELBOW.value].y]
        left_wrist = [landmarks[mp_pose.LEFT_WRIST.value].x, landmarks[mp_pose.LEFT_WRIST.value].y]
        left_hip = [landmarks[mp_pose.LEFT_HIP.value].x, landmarks[mp_pose.LEFT_HIP.value].y]
        left_knee = [landmarks[mp_pose.LEFT_KNEE.value].x, landmarks[mp_pose.LEFT_KNEE.value].y]
        
        angle = self.pose_detector.get_angle(left_shoulder, left_elbow, left_wrist)
        body_angle = self.pose_detector.get_angle(left_shoulder, left_hip, left_knee)
        
        feedback = ""
        
        # Check body alignment
        if body_angle < 160:
            feedback = "Keep your body straight! Don't sag your hips."
        
        # Count reps based on arm angle
        if angle > 160:
            if self.analyzer.stage == "down":
                self.analyzer.rep_count += 1
                feedback = f"Rep {self.analyzer.rep_count}! Great job!"
            self.analyzer.stage = "up"
        elif angle < 90:
            self.analyzer.stage = "down"
            if angle < 70:
                feedback = "Perfect depth! Excellent form!"
        elif 90 <= angle <= 120:
            feedback = "Go lower for full range of motion"
        
        return feedback, self.analyzer.rep_count
    
    def analyze_squat(self, landmarks) -> Tuple[str, int]:
        """Analyze squat form with detailed feedback"""
        mp_pose = mp.solutions.pose.PoseLandmark
        
        left_hip = [landmarks[mp_pose.LEFT_HIP.value].x, landmarks[mp_pose.LEFT_HIP.value].y]
        left_knee = [landmarks[mp_pose.LEFT_KNEE.value].x, landmarks[mp_pose.LEFT_KNEE.value].y]
        left_ankle = [landmarks[mp_pose.LEFT_ANKLE.value].x, landmarks[mp_pose.LEFT_ANKLE.value].y]
        left_shoulder = [landmarks[mp_pose.LEFT_SHOULDER.value].x, landmarks[mp_pose.LEFT_SHOULDER.value].y]
        
        knee_angle = self.pose_detector.get_angle(left_hip, left_knee, left_ankle)
        back_angle = self.pose_detector.get_angle(left_shoulder, left_hip, left_knee)
        
        feedback = ""
        
        # Check back position
        if back_angle < 140:
            feedback = "Keep your chest up! Don't lean too far forward."
        
        # Count reps based on knee angle
        if knee_angle > 160:
            if self.analyzer.stage == "down":
                self.analyzer.rep_count += 1
                feedback = f"Rep {self.analyzer.rep_count}! Excellent!"
            self.analyzer.stage = "up"
        elif knee_angle < 90:
            self.analyzer.stage = "down"
            if knee_angle < 70:
                feedback = "Perfect depth! Great squat!"
        elif 90 <= knee_angle <= 120:
            feedback = "Go deeper for better results"
        
        return feedback, self.analyzer.rep_count
    
    def analyze_situp(self, landmarks) -> Tuple[str, int]:
        """Analyze sit-up form with detailed feedback"""
        mp_pose = mp.solutions.pose.PoseLandmark
        
        left_shoulder = [landmarks[mp_pose.LEFT_SHOULDER.value].x, landmarks[mp_pose.LEFT_SHOULDER.value].y]
        left_hip = [landmarks[mp_pose.LEFT_HIP.value].x, landmarks[mp_pose.LEFT_HIP.value].y]
        left_knee = [landmarks[mp_pose.LEFT_KNEE.value].x, landmarks[mp_pose.LEFT_KNEE.value].y]
        
        angle = self.pose_detector.get_angle(left_shoulder, left_hip, left_knee)
        
        feedback = ""
        
        if angle < 45:
            if self.analyzer.stage == "down":
                self.analyzer.rep_count += 1
                feedback = f"Rep {self.analyzer.rep_count}! Perfect form!"
            self.analyzer.stage = "up"
        elif angle > 90:
            self.analyzer.stage = "down"
            feedback = "Engage your core!"
        
        return feedback, self.analyzer.rep_count
    
    def analyze_plank(self, landmarks) -> Tuple[str, float]:
        """Analyze plank form and duration"""
        mp_pose = mp.solutions.pose.PoseLandmark
        
        left_shoulder = [landmarks[mp_pose.LEFT_SHOULDER.value].x, landmarks[mp_pose.LEFT_SHOULDER.value].y]
        left_hip = [landmarks[mp_pose.LEFT_HIP.value].x, landmarks[mp_pose.LEFT_HIP.value].y]
        left_ankle = [landmarks[mp_pose.LEFT_ANKLE.value].x, landmarks[mp_pose.LEFT_ANKLE.value].y]
        
        body_angle = self.pose_detector.get_angle(left_shoulder, left_hip, left_ankle)
        
        feedback = ""
        
        if body_angle < 160:
            feedback = "Lift your hips! Keep your body straight."
        elif body_angle > 190:
            feedback = "Lower your hips slightly. Don't pike up."
        else:
            feedback = "Perfect plank form! Hold it!"
        
        return feedback, 0
    
    def process_gif(self, gif_path: str) -> Dict:
        """Process GIF and analyze exercise with voice feedback"""
        cap = cv2.VideoCapture(gif_path)
        
        self.analyzer.rep_count = 0
        self.analyzer.stage = None
        all_feedback = []
        detected_exercise = None
        frame_count = 0
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            frame_count += 1
            results = self.pose_detector.detect_pose(frame)
            
            if results.pose_landmarks:
                landmarks = results.pose_landmarks.landmark
                
                # Detect exercise type
                if not detected_exercise:
                    detected_exercise = self.analyzer.detect_exercise_from_pose(landmarks)
                    if detected_exercise:
                        exercise_info = self.analyzer.get_exercise_info(detected_exercise)
                        instructions = exercise_info.get('instructions', [])
                        if instructions:
                            self.speak(f"Starting {detected_exercise}. {instructions[0]}")
                        all_feedback.append(f"Detected: {detected_exercise}")
                
                # Analyze based on exercise type
                feedback = ""
                if detected_exercise:
                    if "push" in detected_exercise.lower():
                        feedback, count = self.analyze_pushup(landmarks)
                    elif "squat" in detected_exercise.lower():
                        feedback, count = self.analyze_squat(landmarks)
                    elif "sit" in detected_exercise.lower():
                        feedback, count = self.analyze_situp(landmarks)
                    elif "plank" in detected_exercise.lower():
                        feedback, _ = self.analyze_plank(landmarks)
                
                if feedback:
                    all_feedback.append(feedback)
                    if frame_count % 30 == 0:  # Voice feedback every 30 frames
                        self.speak(feedback)
        
        cap.release()
        
        exercise_info = self.analyzer.get_exercise_info(detected_exercise) if detected_exercise else {}
        
        return {
            "exercise": detected_exercise or "Unknown",
            "total_reps": self.analyzer.rep_count,
            "feedback": all_feedback,
            "instructions": exercise_info.get('instructions', []),
            "body_part": exercise_info.get('body_part', ''),
            "target": exercise_info.get('target', ''),
            "equipment": exercise_info.get('equipment', '')
        }
    
    def process_video_stream(self, video_source=0):
        """Process live video stream with real-time feedback"""
        cap = cv2.VideoCapture(video_source)
        
        self.analyzer.rep_count = 0
        self.analyzer.stage = None
        detected_exercise = None
        instructions_shown = False
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            # Flip frame for mirror view
            frame = cv2.flip(frame, 1)
            
            results = self.pose_detector.detect_pose(frame)
            
            if results.pose_landmarks:
                landmarks = results.pose_landmarks.landmark
                
                # Detect exercise
                if not detected_exercise:
                    detected_exercise = self.analyzer.detect_exercise_from_pose(landmarks)
                    if detected_exercise:
                        self.speak(f"Detected {detected_exercise}")
                        exercise_info = self.analyzer.get_exercise_info(detected_exercise)
                        instructions = exercise_info.get('instructions', [])
                        if instructions and not instructions_shown:
                            self.speak(instructions[0])
                            instructions_shown = True
                
                # Analyze exercise
                feedback = ""
                if detected_exercise:
                    if "push" in detected_exercise.lower():
                        feedback, count = self.analyze_pushup(landmarks)
                    elif "squat" in detected_exercise.lower():
                        feedback, count = self.analyze_squat(landmarks)
                    elif "sit" in detected_exercise.lower():
                        feedback, count = self.analyze_situp(landmarks)
                    elif "plank" in detected_exercise.lower():
                        feedback, _ = self.analyze_plank(landmarks)
                
                # Draw pose
                self.pose_detector.mp_draw.draw_landmarks(
                    frame, results.pose_landmarks, self.pose_detector.mp_pose.POSE_CONNECTIONS,
                    self.pose_detector.mp_draw.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=2),
                    self.pose_detector.mp_draw.DrawingSpec(color=(0, 0, 255), thickness=2)
                )
                
                # Display info
                cv2.rectangle(frame, (0, 0), (400, 150), (0, 0, 0), -1)
                cv2.putText(frame, f"Exercise: {detected_exercise or 'Detecting...'}", 
                           (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
                cv2.putText(frame, f"Reps: {self.analyzer.rep_count}", 
                           (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
                if feedback:
                    cv2.putText(frame, feedback, (10, 110), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
            
            cv2.imshow('AI Trainer - Press Q to quit', frame)
            
            if cv2.waitKey(10) & 0xFF == ord('q'):
                break
        
        cap.release()
        cv2.destroyAllWindows()

# Example usage
if __name__ == "__main__":
    # Path to exercises dataset
    exercises_path = os.path.join(os.path.dirname(__file__), "exercises.csv")
    
    # Initialize AI Trainer
    trainer = AITrainer(exercises_path)
    
    # Process GIF
    gif_path = os.path.join(os.path.dirname(__file__), "gifs", "34-sit-up.gif")
    if os.path.exists(gif_path):
        result = trainer.process_gif(gif_path)
        print(f"Exercise: {result['exercise']}")
        print(f"Total Reps: {result['total_reps']}")
        print(f"Instructions: {result['instructions']}")
        print(f"Feedback: {result['feedback']}")
    
    # Or process live video
    # trainer.process_video_stream(0)
