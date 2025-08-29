@echo off
echo Setting up PostgreSQL database for POD system...

echo Creating database...
psql -U postgres -c "CREATE DATABASE pod_database;"

echo Running schema...
psql -U postgres -d pod_database -f database/schema.sql

echo Database setup complete!
echo.
echo Update your .env file with:
echo DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/pod_database
pause