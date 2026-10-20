-- REMS Database Schema
-- Version 1: Core database foundation

CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (
        role IN ('admin', 'agent', 'buyer', 'owner')
    ),
    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS properties (
    property_id INTEGER PRIMARY KEY,
    owner_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    address TEXT NOT NULL,
    price REAL NOT NULL CHECK (price >= 0),
    property_type TEXT NOT NULL,
    listing_type TEXT NOT NULL CHECK (
        listing_type IN ('sale', 'rent')
    ),
    status TEXT NOT NULL DEFAULT 'available' CHECK (
        status IN ('available', 'pending', 'sold', 'rented', 'archived')
    ),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (owner_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS agent_assignments (
    assignment_id INTEGER PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    property_id INTEGER NOT NULL,
    assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (agent_id) REFERENCES users(user_id),
    FOREIGN KEY (property_id) REFERENCES properties(property_id),
    UNIQUE (agent_id, property_id)
);

CREATE TABLE IF NOT EXISTS visits (
    visit_id INTEGER PRIMARY KEY,
    property_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    scheduled_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'approved', 'rescheduled', 'completed', 'cancelled')
    ),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (property_id) REFERENCES properties(property_id),
    FOREIGN KEY (client_id) REFERENCES users(user_id)
);