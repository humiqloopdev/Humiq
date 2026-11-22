-- Reference data the platform needs to work: the three subscription plans (admins can edit them later).
INSERT INTO subscription_plans (code, name, price_monthly, max_roles, features) VALUES
  ('starter',    'Starter',    299,  3,    ARRAY['3 active roles','Basic candidate pool','Talent search','90-day history']),
  ('pro',        'Pro',        699,  10,   ARRAY['10 active roles','Full candidate pool','Advanced analytics','API access']),
  ('enterprise', 'Enterprise', NULL, NULL, ARRAY['Unlimited roles','Dedicated support','SSO and custom configuration','Contract pricing'])
ON CONFLICT (code) DO NOTHING;
