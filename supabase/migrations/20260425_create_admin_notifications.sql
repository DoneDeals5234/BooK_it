-- Create admin_notifications table
CREATE TABLE IF NOT EXISTS admin_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL,
    order_id UUID REFERENCES orders(id),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow public insert" ON admin_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select" ON admin_notifications FOR SELECT USING (true);
CREATE POLICY "Allow public update" ON admin_notifications FOR UPDATE USING (true);
