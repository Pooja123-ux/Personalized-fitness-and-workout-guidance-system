export const yogaSteps: Record<string, { steps: string[]; image: string; gif?: string }> = {
  'surya namaskar': { steps: ['Stand at mat front', 'Inhale raise arms', 'Exhale forward fold', 'Step back to plank', 'Lower to floor', 'Upward dog', 'Downward dog', 'Step forward and rise'], image: '/icons/surya_namaskar.svg', gif: '/gifs/surya_namaskar.gif' },
  'bridge pose': { steps: ['Lie on back', 'Bend knees', 'Press feet', 'Lift hips', 'Hold and breathe'], image: '/icons/bridge_pose.svg', gif: '/gifs/bridge_pose.gif' },
  'boat pose': { steps: ['Sit tall', 'Lift legs', 'Balance on sit bones', 'Extend arms', 'Hold core engaged'], image: '/icons/boat_pose.svg', gif: '/gifs/boat_pose.gif' },
  'warrior pose': { steps: ['Step wide', 'Turn front foot', 'Bend front knee', 'Arms out', 'Gaze forward'], image: '/icons/warrior_pose.svg', gif: '/gifs/warrior_pose.gif' },
  'chair pose': { steps: ['Feet together', 'Bend knees', 'Reach arms', 'Chest lifted'], image: '/icons/chair_pose.svg', gif: '/gifs/chair_pose.gif' },
  'downward dog': { steps: ['Hands down', 'Lift hips', 'Straighten legs', 'Relax neck'], image: '/icons/downward_dog.svg', gif: '/gifs/downward_dog.gif' },
  'plank variations': { steps: ['High plank', 'Elbow plank', 'Side plank'], image: '/icons/plank_variations.svg', gif: '/gifs/plank_variations.gif' }
}
export const workoutSteps: Record<string, { steps: string[]; image: string; gif?: string }> = {
  'brisk walking 30m': { steps: ['Stand tall', 'Walk briskly', 'Swing arms', 'Maintain pace'], image: '/icons/brisk_walking.svg', gif: '/gifs/brisk_walking.gif' },
  'bodyweight squats 3x12': { steps: ['Feet shoulder-width', 'Push hips back', 'Keep chest up', 'Stand to start'], image: '/icons/bodyweight_squats.svg', gif: '/gifs/bodyweight_squats.gif' },
  'push-ups 3x10': { steps: ['Hands under shoulders', 'Lower chest', 'Keep core tight', 'Press up'], image: '/icons/push_ups.svg', gif: '/gifs/push_ups.gif' },
  'plank 3x30s': { steps: ['Elbows under shoulders', 'Straight body line', 'Hold 30s'], image: '/icons/plank.svg', gif: '/gifs/plank.gif' },
  'lunges 3x12': { steps: ['Step forward', 'Lower to 90°', 'Push back', 'Alternate sides'], image: '/icons/lunges.svg', gif: '/gifs/lunges.gif' },
  'rows 3x10': { steps: ['Hinge hips', 'Pull weight to ribs', 'Squeeze back'], image: '/icons/rows.svg', gif: '/gifs/rows.gif' },
  'squats 5x5': { steps: ['Feet shoulder-width', 'Back neutral', 'Drive through heels'], image: '/icons/squats.svg', gif: '/gifs/squats.gif' },
  'deadlifts 5x5': { steps: ['Bar over midfoot', 'Hips hinge', 'Stand tall'], image: '/icons/deadlifts.svg', gif: '/gifs/deadlifts.gif' },
  'bench press 5x5': { steps: ['Grip bar', 'Lower to chest', 'Press up'], image: '/icons/bench_press.svg', gif: '/gifs/bench_press.gif' },
  'pull-ups 4x8': { steps: ['Full hang', 'Pull chin over bar', 'Control down'], image: '/icons/pull_ups.svg', gif: '/gifs/pull_ups.gif' }
}

export const fallbackFoodsByMeal: Record<string, { food: string; calories_per_100g: number }[]> = {
  breakfast: [
    { food: 'Idli (steamed rice cake)', calories_per_100g: 130 },
    { food: 'Dosa (plain)', calories_per_100g: 168 },
    { food: 'Poha (flattened rice)', calories_per_100g: 180 }
  ],
  lunch: [
    { food: 'Cooked white rice', calories_per_100g: 130 },
    { food: 'Chapati (whole wheat)', calories_per_100g: 240 },
    { food: 'Dal (cooked)', calories_per_100g: 120 }
  ],
  snacks: [
    { food: 'Banana', calories_per_100g: 89 },
    { food: 'Plain yogurt', calories_per_100g: 60 },
    { food: 'Roasted chana', calories_per_100g: 370 }
  ],
  dinner: [
    { food: 'Cooked white rice', calories_per_100g: 130 },
    { food: 'Vegetable sabzi', calories_per_100g: 80 },
    { food: 'Paneer curry', calories_per_100g: 250 }
  ]
}
