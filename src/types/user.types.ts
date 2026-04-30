import { user_role } from "../generated/prisma/client";

/*Input (create user)*/
export type CreateUserDTO = {
  full_name: string;
  phone_number: string;
  password_hash: string; 
  role?: user_role;
  address?: string | null;
  profile_image?: string | null;
};

/*Output (response) */
export type UserResponseDTO = {
  id: string;
  full_name: string;
  phone_number: string;
  role: user_role;
  address: string | null;
  profile_image: string | null;
  created_at: Date | null;
  updated_at: Date | null;
};

export type RegisterUserDTO = {
    full_name: string;
    phone_number: string;
    password: string;
    confirmPassword: string;
}