import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../../shared/database/prisma';
import config from '../../config';
import { AppError } from '../../shared/errors/app-error';
import { RegisterInput, LoginInput } from './auth.schema';

export interface UserResponse {
  id: string;
  fullName: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginResponse {
  token: string;
  user: UserResponse;
}

export class AuthService {
  public async register(input: RegisterInput): Promise<UserResponse> {
    const existingUser = await prisma.user.findFirst({
      where: {
        email: input.email,
        isDeleted: false,
      },
    });

    if (existingUser) {
      throw new AppError('Email already exists', 400);
    }

    const saltRounds: number = 10;
    const passwordHash: string = await bcrypt.hash(input.password, saltRounds);

    const user = await prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        passwordHash,
      },
    });

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  public async login(input: LoginInput): Promise<LoginResponse> {
    const user = await prisma.user.findFirst({
      where: {
        email: input.email,
        isDeleted: false,
      },
    });

    if (!user) {
      throw new AppError('Invalid credentials', 400);
    }

    const isPasswordValid: boolean = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 400);
    }

    const token: string = jwt.sign({ id: user.id, email: user.email }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    });

    return {
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  public async getMe(userId: string): Promise<UserResponse> {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        isDeleted: false,
      },
    });

    if (!user) {
      throw new AppError('Unauthorized', 401);
    }

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
