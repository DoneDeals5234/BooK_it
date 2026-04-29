-- Seed initial subscription plans
BEGIN;

INSERT INTO plans (name, description, features) VALUES
  (
    'Basic',
    'Perfect for getting started',
    '["Online/offline status", "Basic booking system", "Upto 5 staff members", "Mobile app access"]'::jsonb
  ),
  (
    'Professional',
    'For growing businesses',
    '["Online/offline status", "Advanced booking system", "Upto 20 staff members", "Mobile app access", "Customer notifications", "Booking analytics", "Custom category"]'::jsonb
  ),
  (
    'Premium',
    'For established businesses',
    '["Online/offline status", "Advanced booking system", "Unlimited staff members", "Mobile app access", "Customer notifications", "Advanced analytics", "Custom domain", "Marketing campaigns", "Priority support"]'::jsonb
  )
ON CONFLICT (name) DO NOTHING;

-- Verify that plans were created
SELECT name, description FROM plans ORDER BY created_at;

COMMIT;
