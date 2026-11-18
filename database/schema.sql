PRAGMA foreign_keys = ON;

BEGIN;

CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    full_name TEXT NOT NULL CHECK (length(trim(full_name)) > 0),
    email TEXT NOT NULL COLLATE NOCASE UNIQUE
        CHECK (instr(email, '@') > 1),
    password_hash TEXT NOT NULL,
    phone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'agent', 'buyer', 'owner')),
    assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER,
    PRIMARY KEY (user_id, role),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS client_profiles (
    user_id INTEGER PRIMARY KEY,
    preferred_listing_type TEXT CHECK (
        preferred_listing_type IN ('sale', 'rent')
    ),
    preferred_city TEXT,
    min_budget REAL CHECK (min_budget IS NULL OR min_budget >= 0),
    max_budget REAL CHECK (max_budget IS NULL OR max_budget >= 0),
    min_bedrooms INTEGER CHECK (min_bedrooms IS NULL OR min_bedrooms >= 0),
    min_bathrooms INTEGER CHECK (min_bathrooms IS NULL OR min_bathrooms >= 0),
    notes TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        min_budget IS NULL OR max_budget IS NULL OR min_budget <= max_budget
    ),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS properties (
    property_id INTEGER PRIMARY KEY,
    owner_id INTEGER NOT NULL,
    created_by INTEGER,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    description TEXT,
    property_type TEXT NOT NULL CHECK (
        property_type IN ('residential', 'commercial', 'industrial', 'land', 'other')
    ),
    listing_type TEXT NOT NULL CHECK (listing_type IN ('sale', 'rent')),
    price REAL NOT NULL CHECK (price >= 0),
    price_period TEXT CHECK (
        price_period IN ('daily', 'weekly', 'monthly', 'yearly')
    ),
    area_marla REAL CHECK (area_marla IS NULL OR area_marla > 0),
    area_sqft REAL CHECK (area_sqft IS NULL OR area_sqft > 0),
    bedrooms INTEGER CHECK (bedrooms IS NULL OR bedrooms >= 0),
    bathrooms INTEGER CHECK (bathrooms IS NULL OR bathrooms >= 0),
    address TEXT NOT NULL CHECK (length(trim(address)) > 0),
    area TEXT,
    city TEXT NOT NULL,
    province TEXT,
    postal_code TEXT,
    latitude REAL CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    longitude REAL CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    status TEXT NOT NULL DEFAULT 'available' CHECK (
        status IN ('draft', 'available', 'pending', 'under_offer',
                   'under_contract', 'sold', 'rented', 'archived')
    ),
    published_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (listing_type = 'sale' AND price_period IS NULL)
        OR
        (listing_type = 'rent' AND price_period IS NOT NULL)
    ),
    FOREIGN KEY (owner_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_properties_search
    ON properties(status, listing_type, property_type, price);
CREATE INDEX IF NOT EXISTS idx_properties_location
    ON properties(city, area);
CREATE INDEX IF NOT EXISTS idx_properties_owner
    ON properties(owner_id);

CREATE TABLE IF NOT EXISTS property_images (
    image_id INTEGER PRIMARY KEY,
    property_id INTEGER NOT NULL,
    image_path TEXT NOT NULL,
    alt_text TEXT,
    display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    is_cover INTEGER NOT NULL DEFAULT 0 CHECK (is_cover IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (property_id, image_path),
    FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_property_images_order
    ON property_images(property_id, display_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_property_one_cover_image
    ON property_images(property_id) WHERE is_cover = 1;

CREATE TABLE IF NOT EXISTS property_features (
    feature_id INTEGER PRIMARY KEY,
    property_id INTEGER NOT NULL,
    feature_name TEXT NOT NULL CHECK (length(trim(feature_name)) > 0),
    feature_value TEXT,
    FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE,
    UNIQUE (property_id, feature_name)
);

CREATE TABLE IF NOT EXISTS agent_assignments (
    assignment_id INTEGER PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    property_id INTEGER NOT NULL,
    assigned_by INTEGER,
    assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    unassigned_at TEXT,
    FOREIGN KEY (agent_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(user_id) ON DELETE SET NULL,
    CHECK (unassigned_at IS NULL OR unassigned_at >= assigned_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_active_agent_property
    ON agent_assignments(agent_id, property_id) WHERE unassigned_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assignments_agent
    ON agent_assignments(agent_id, unassigned_at);

CREATE TABLE IF NOT EXISTS saved_properties (
    user_id INTEGER NOT NULL,
    property_id INTEGER NOT NULL,
    saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, property_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inquiries (
    inquiry_id INTEGER PRIMARY KEY,
    property_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    assigned_agent_id INTEGER,
    subject TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (
        status IN ('open', 'in_progress', 'responded', 'closed')
    ),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE RESTRICT,
    FOREIGN KEY (client_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (assigned_agent_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_inquiries_agent_status
    ON inquiries(assigned_agent_id, status);

CREATE TABLE IF NOT EXISTS applications (
    application_id INTEGER PRIMARY KEY,
    property_id INTEGER NOT NULL,
    applicant_id INTEGER NOT NULL,
    application_type TEXT NOT NULL CHECK (application_type IN ('sale', 'rent')),
    proposed_amount REAL CHECK (proposed_amount IS NULL OR proposed_amount >= 0),
    proposed_rent_period TEXT CHECK (
        proposed_rent_period IN ('daily', 'weekly', 'monthly', 'yearly')
    ),
    message TEXT,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (
        status IN ('submitted', 'under_review', 'accepted', 'rejected', 'withdrawn')
    ),
    reviewed_by INTEGER,
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (application_type = 'sale' AND proposed_rent_period IS NULL)
        OR
        (application_type = 'rent')
    ),
    FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE RESTRICT,
    FOREIGN KEY (applicant_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_applications_property_status
    ON applications(property_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_applicant
    ON applications(applicant_id, created_at);

CREATE TABLE IF NOT EXISTS offers (
    offer_id INTEGER PRIMARY KEY,
    application_id INTEGER NOT NULL,
    offered_by INTEGER NOT NULL,
    amount REAL NOT NULL CHECK (amount >= 0),
    rent_period TEXT CHECK (rent_period IN ('daily', 'weekly', 'monthly', 'yearly')),
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'accepted', 'rejected', 'countered', 'withdrawn')
    ),
    responded_by INTEGER,
    responded_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(application_id) ON DELETE RESTRICT,
    FOREIGN KEY (offered_by) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (responded_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_offers_application
    ON offers(application_id, created_at);

CREATE TABLE IF NOT EXISTS visits (
    visit_id INTEGER PRIMARY KEY,
    property_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    assigned_agent_id INTEGER,
    scheduled_at TEXT NOT NULL,
    rescheduled_from TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'approved', 'rescheduled', 'completed', 'cancelled')
    ),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE RESTRICT,
    FOREIGN KEY (client_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (assigned_agent_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_visit_property_slot
    ON visits(property_id, scheduled_at)
    WHERE status IN ('pending', 'approved', 'rescheduled');
CREATE UNIQUE INDEX IF NOT EXISTS idx_visit_client_slot
    ON visits(client_id, scheduled_at)
    WHERE status IN ('pending', 'approved', 'rescheduled');
CREATE UNIQUE INDEX IF NOT EXISTS idx_visit_agent_slot
    ON visits(assigned_agent_id, scheduled_at)
    WHERE assigned_agent_id IS NOT NULL
      AND status IN ('pending', 'approved', 'rescheduled');
CREATE INDEX IF NOT EXISTS idx_visits_agent_status
    ON visits(assigned_agent_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_visits_client
    ON visits(client_id, scheduled_at);

CREATE TABLE IF NOT EXISTS transactions (
    transaction_id INTEGER PRIMARY KEY,
    property_id INTEGER NOT NULL,
    application_id INTEGER,
    accepted_offer_id INTEGER UNIQUE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('sale', 'rent')),
    buyer_tenant_id INTEGER NOT NULL,
    owner_id INTEGER NOT NULL,
    agent_id INTEGER,
    agreed_amount REAL NOT NULL CHECK (agreed_amount >= 0),
    rent_period TEXT CHECK (rent_period IN ('daily', 'weekly', 'monthly', 'yearly')),
    security_deposit REAL CHECK (security_deposit IS NULL OR security_deposit >= 0),
    start_date TEXT,
    end_date TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'active', 'completed', 'cancelled')
    ),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (transaction_type = 'sale' AND rent_period IS NULL)
        OR
        (transaction_type = 'rent' AND rent_period IS NOT NULL)
    ),
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
    FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE RESTRICT,
    FOREIGN KEY (application_id) REFERENCES applications(application_id) ON DELETE RESTRICT,
    FOREIGN KEY (accepted_offer_id) REFERENCES offers(offer_id) ON DELETE RESTRICT,
    FOREIGN KEY (buyer_tenant_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (owner_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (agent_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_property
    ON transactions(property_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_participants
    ON transactions(buyer_tenant_id, owner_id, status);

CREATE TABLE IF NOT EXISTS invoices (
    invoice_id INTEGER PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE,
    transaction_id INTEGER,
    application_id INTEGER,
    property_id INTEGER,
    issued_to_user_id INTEGER NOT NULL,
    created_by INTEGER,
    invoice_type TEXT NOT NULL CHECK (
        invoice_type IN ('booking_fee', 'security_deposit', 'rent', 'installment',
                         'listing_fee', 'other')
    ),
    amount REAL NOT NULL CHECK (amount >= 0),
    due_date TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (
        status IN ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled')
    ),
    description TEXT,
    issued_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id) ON DELETE RESTRICT,
    FOREIGN KEY (application_id) REFERENCES applications(application_id) ON DELETE RESTRICT,
    FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE RESTRICT,
    FOREIGN KEY (issued_to_user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_status
    ON invoices(issued_to_user_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_transaction
    ON invoices(transaction_id);

CREATE TABLE IF NOT EXISTS payments (
    payment_id INTEGER PRIMARY KEY,
    invoice_id INTEGER NOT NULL,
    amount REAL NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL CHECK (
        payment_method IN ('cash', 'credit_card', 'bank_transfer', 'cheque', 'other')
    ),
    status TEXT NOT NULL DEFAULT 'recorded' CHECK (
        status IN ('recorded', 'pending', 'failed', 'refunded')
    ),
    paid_at TEXT,
    reference_number TEXT,
    recorded_by INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE RESTRICT,
    FOREIGN KEY (recorded_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice
    ON payments(invoice_id, status);

CREATE TABLE IF NOT EXISTS notifications (
    notification_id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    notification_type TEXT NOT NULL CHECK (
        notification_type IN ('visit', 'application', 'offer', 'transaction',
                              'payment', 'listing', 'system', 'other')
    ),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_entity_type TEXT,
    related_entity_id INTEGER,
    is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications(user_id, is_read, created_at);

CREATE TABLE IF NOT EXISTS activity_logs (
    activity_id INTEGER PRIMARY KEY,
    actor_user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_time
    ON activity_logs(actor_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity
    ON activity_logs(entity_type, entity_id, created_at);

COMMIT;
