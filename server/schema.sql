CREATE DATABASE IF NOT EXISTS campus_hall;
USE campus_hall;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('cr','admin') NOT NULL DEFAULT 'cr',
  department VARCHAR(100),
  class_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS halls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  capacity INT NOT NULL DEFAULT 0,
  location VARCHAR(150),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hall_id INT NOT NULL,
  user_id INT NOT NULL,
  purpose VARCHAR(255) NOT NULL,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status ENUM('confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_booking_hall FOREIGN KEY (hall_id) REFERENCES halls(id),
  CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_hall_date (hall_id, booking_date, status)
);

CREATE TABLE IF NOT EXISTS waitlist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hall_id INT NOT NULL,
  user_id INT NOT NULL,
  purpose VARCHAR(255) NOT NULL,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status ENUM('waiting','offered','booked','cancelled') NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wait_hall FOREIGN KEY (hall_id) REFERENCES halls(id),
  CONSTRAINT fk_wait_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_wait_queue (hall_id, booking_date, status, created_at)
);

CREATE TABLE IF NOT EXISTS hall_blocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hall_id INT NOT NULL,
  block_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason VARCHAR(255) NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_block_hall FOREIGN KEY (hall_id) REFERENCES halls(id),
  CONSTRAINT fk_block_user FOREIGN KEY (created_by) REFERENCES users(id)
);

INSERT INTO halls (name, capacity, location) VALUES
('Examination Hall 1', 100, 'Main Block'),
('Examination Hall 2', 80, 'Main Block'),
('Seminar Hall', 150, 'Admin Block'),
('Auditorium', 300, 'Central Block');
