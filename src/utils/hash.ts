import bcrypt from "bcrypt";

// method to hash a password using bcrypt
export const hashPassword = async (password: string) => {
  return bcrypt.hash(password, 10);
};

// method to compare a password with a hashed password using bcrypt
export const comparePassword = async (password: string, hash: string) => {
  return bcrypt.compare(password, hash);
};
