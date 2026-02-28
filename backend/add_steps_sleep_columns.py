"""
Add steps and sleep columns to adherence_logs table
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "storage" / "fitness.db"

def add_columns():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute("PRAGMA table_info(adherence_logs)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'steps' not in columns:
            cursor.execute("ALTER TABLE adherence_logs ADD COLUMN steps INTEGER DEFAULT 0")
            print("Added 'steps' column")
        else:
            print("'steps' column already exists")
        
        if 'steps_target' not in columns:
            cursor.execute("ALTER TABLE adherence_logs ADD COLUMN steps_target INTEGER DEFAULT 10000")
            print("Added 'steps_target' column")
        else:
            print("'steps_target' column already exists")
        
        if 'sleep_hours' not in columns:
            cursor.execute("ALTER TABLE adherence_logs ADD COLUMN sleep_hours REAL DEFAULT 0")
            print("Added 'sleep_hours' column")
        else:
            print("'sleep_hours' column already exists")
        
        if 'sleep_target_hours' not in columns:
            cursor.execute("ALTER TABLE adherence_logs ADD COLUMN sleep_target_hours REAL DEFAULT 7.5")
            print("Added 'sleep_target_hours' column")
        else:
            print("'sleep_target_hours' column already exists")
        
        conn.commit()
        print("\nDatabase migration completed successfully!")
        
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    add_columns()
