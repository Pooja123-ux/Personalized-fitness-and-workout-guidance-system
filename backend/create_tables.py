# create_tables.py
from app.database import Base, engine
from app.models import *
# Create all tables in the database
Base.metadata.create_all(bind=engine)

print("✅ All tables created successfully!")
