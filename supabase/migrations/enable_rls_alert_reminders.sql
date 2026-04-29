-- Enable Row Level Security on alert_reminders table
ALTER TABLE alert_reminders ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow users to insert their own reminders
CREATE POLICY alert_reminders_insert_policy ON alert_reminders
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Policy 2: Allow users to read their own reminders
CREATE POLICY alert_reminders_select_policy ON alert_reminders
  FOR SELECT
  USING (auth.uid()::text = user_id);

-- Policy 3: Allow users to update their own reminders
CREATE POLICY alert_reminders_update_policy ON alert_reminders
  FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- Policy 4: Allow users to delete their own reminders
CREATE POLICY alert_reminders_delete_policy ON alert_reminders
  FOR DELETE
  USING (auth.uid()::text = user_id);

-- Policy 5: Allow service role (backend functions) full access
CREATE POLICY alert_reminders_service_role_policy ON alert_reminders
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
