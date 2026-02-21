const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// API endpoint to serve exercises data
app.get('/api/exercises', (req, res) => {
  try {
    const csvPath = path.join(__dirname, 'app', 'exercises.csv');
    const csvData = fs.readFileSync(csvPath, 'utf8');
    
    // Parse CSV
    const lines = csvData.split('\n');
    const headers = lines[0].split(',');
    const exercises = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length >= headers.length) {
        const exercise = {
          id: values[0]?.trim() || '',
          name: values[1]?.trim() || '',
          bodyPart: values[2]?.trim() || '',
          equipment: values[3]?.trim() || '',
          gifUrl: values[4]?.trim() || '',
          target: values[5]?.trim() || '',
          secondaryMuscles: values[6]?.split(';').map(m => m.trim()) || [],
          instructions: []
        };
        
        // Add instructions from columns 7 onwards
        for (let j = 7; j < values.length; j++) {
          if (values[j] && values[j].trim()) {
            exercise.instructions.push(values[j].trim());
          }
        }
        
        exercises.push(exercise);
      }
    }
    
    res.json(exercises);
  } catch (error) {
    console.error('Error reading exercises CSV:', error);
    res.status(500).json({ error: 'Failed to load exercises data' });
  }
});

app.listen(PORT, () => {
  console.log(`Exercise API server running on port ${PORT}`);
});
