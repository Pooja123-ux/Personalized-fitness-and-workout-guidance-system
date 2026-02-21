const fs = require('fs');
const path = require('path');

// Read CSV file
const csvPath = path.join(__dirname, 'app', 'exercises.csv');
const csvData = fs.readFileSync(csvPath, 'utf8');

// Parse CSV
const lines = csvData.split('\n');
const headers = lines[0].split(',');
const exercises = [];

for (let i = 1; i < lines.length; i++) {
  const values = lines[i].split(',');
  if (values.length >= 7) {
    const exercise = {
      id: values[3]?.trim() || '', // id is at position 3
      name: values[4]?.trim() || '', // name is at position 4
      bodyPart: values[0]?.trim() || '', // bodyPart is at position 0
      equipment: values[1]?.trim() || '', // equipment is at position 1
      gifUrl: values[2]?.trim() || '', // gifUrl is at position 2
      target: values[5]?.trim() || '', // target is at position 5
      secondaryMuscles: [],
      instructions: []
    };
    
    // Parse secondary muscles and instructions from remaining fields
    for (let j = 6; j < values.length; j++) {
      const header = headers[j];
      const value = values[j]?.trim();
      
      if (header && header.startsWith('secondaryMuscles/') && value && value !== '') {
        exercise.secondaryMuscles.push(value);
      } else if (header && header.startsWith('instructions/') && value && value !== '') {
        exercise.instructions.push(value);
      }
    }
    
    exercises.push(exercise);
  }
}

// Write to JSON file
fs.writeFileSync(path.join(__dirname, 'exercises.json'), JSON.stringify(exercises, null, 2));
console.log(`Converted ${exercises.length} exercises to JSON format`);
