@echo off
SET PGPASSWORD=7a77a8f2ca424b21a8252a282cee1163
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -c "SELECT version();"