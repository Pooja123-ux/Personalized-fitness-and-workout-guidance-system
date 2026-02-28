"""
Remove steps and sleep columns from adherence_logs table
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "storage" / "fitness.db"

def remove_columns():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # SQLite doesn't support DROP COLUMN directly, need to recreate table
        cursor.execute("PRAGMA table_info(adherence_logs)")
        columns = cursor.fetchall()
        
        # Check if steps/sleep columns exist
        col_names = [col[1] for col in columns]
        has_steps = 'steps' in col_names or 'steps_target' in col_names
        has_sleep = 'sleep_hours' in col_names or 'sleep_target_hours' in col_names
        
        if not has_steps and not has_sleep:
            print("No steps or sleep columns found. Database is already clean.")
            return
        
        print("Recreating adherence_logs table without steps/sleep columns...")
        
        # Create new table without steps/sleep
        cursor.execute("""
            CREATE TABLE adherence_logs_new (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                log_date VARCHAR(20) NOT NULL,
                planned_calories REAL DEFAULT 0,
                consumed_planned_calories REAL DEFAULT 0,
                completed_items_count INTEGER DEFAULT 0,
                total_items_count INTEGER DEFAULT 0,
                completed_item_ids_json TEXT DEFAULT '[]',
                extra_foods_json TEXT DEFAULT '[]',
                water_ml INTEGER DEFAULT 0,
                water_target_ml INTEGER DEFAULT 2000,
                created_at DATETIME,
                updated_at DATETIME,
                UNIQUE(user_id, log_date)
            )
        """)
        
        # Copy data from old table
        cursor.execute("""
            INSERT INTO adherence_logs_new 
            (id, user_id, log_date, planned_calories, consumed_planned_calories, 
             completed_items_count, total_items_count, completed_item_ids_json, 
             extra_foods_json, water_ml, water_target_ml, created_at, updated_at)
            SELECT id, user_id, log_date, planned_calories, consumed_planned_calories,
                   completed_items_count, total_items_count, completed_item_ids_json,
                   extra_foods_json, water_ml, water_target_ml, created_at, updated_at
            FROM adherence_logs
        """)
        
        # Drop old table
        cursor.execute("DROP TABLE adherence_logs")
        
        # Rename new table
        cursor.execute("ALTER TABLE adherence_logs_new RENAME TO adherence_logs")
        
        # Recreate index
        cursor.execute("CREATE INDEX ix_adherence_logs_user_id ON adherence_logs (user_id)")
        cursor.execute("CREATE INDEX ix_adherence_logs_log_date ON adherence_logs (log_date)")
        
        conn.commit()
        print("Successfully removed steps and sleep columns from adherence_logs table!")
        
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    remove_columns()
