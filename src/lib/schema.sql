
-- This file defines the database schema for the application.
-- Use this to set up your MySQL database.

-- Drop tables if they exist to start fresh
DROP TABLE IF EXISTS `users`;

-- Users table to store login information and roles for all individuals
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL, -- Should store a hash of the password
  `role` ENUM('admin', 'merchant', 'sale_agent', 'staff') NOT NULL,
  `permissions` JSON, -- For staff role: e.g., {"pages": ["transactions", "merchants"], "actions": ["view", "edit"]}
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add a default admin user for initial setup
-- In production, you should use a more secure password and manage users through the app
INSERT INTO `users` (`name`, `email`, `password`, `role`) VALUES
('Admin User', 'admin@comfortpay.com', '$2b$10$your_bcrypt_hash_here', 'admin'),
('Merchant User', 'merchant@comfortpay.com', '$2b$10$your_bcrypt_hash_here', 'merchant');


-- You would also have your other tables like `merchants`, `orders`, etc.
-- For example:
-- CREATE TABLE `merchants` ( ... );
-- CREATE TABLE `orders` ( ... );
-- CREATE TABLE `payment_accounts` ( ... );
