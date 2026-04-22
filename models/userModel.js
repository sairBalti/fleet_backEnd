const pool = require("../config/db");

const User = {}

// Register a new user
User.register = (role, email, passwordHash, callback) => {
    pool.query("CALL InsertUser(?, ?, ?)", [role, email, passwordHash], (err, results) => {
      if (err) {
        console.error("Database Error:", err);
        return callback(err, null);
      }
      return callback(null, { message: "User registered successfully!" });
    });
  };


  User.authenticate = (email, callback) => {
    pool.query("CALL AuthenticateUser(?)", [email], (err, results) => {
      if (err) return callback(err, null);
      return callback(null, results[0][0]); // Return first row (user data)
    });
  };
  
  module.exports = User;