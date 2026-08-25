import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BranchResponseDto,
  CreateBranchDto,
  CreateDepartmentDto,
  DepartmentResponseDto,
  UpdateBranchDto,
  UpdateDepartmentDto,
} from './dto/org-unit.dto';

const DEPARTMENT_SELECT = {
  id: true,
  key: true,
  name: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.DepartmentSelect;

const BRANCH_SELECT = {
  id: true,
  key: true,
  name: true,
  city: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.BranchSelect;

type SelectedDepartment = Prisma.DepartmentGetPayload<{ select: typeof DEPARTMENT_SELECT }>;
type SelectedBranch = Prisma.BranchGetPayload<{ select: typeof BRANCH_SELECT }>;

@Injectable()
export class OrgService {
  constructor(private readonly prisma: PrismaService) {}

  async listDepartments(): Promise<DepartmentResponseDto[]> {
    const rows = await this.prisma.department.findMany({
      select: DEPARTMENT_SELECT,
      orderBy: { name: 'asc' },
    });

    return rows.map((row) => OrgService.toDepartmentResponse(row));
  }

  async createDepartment(dto: CreateDepartmentDto): Promise<DepartmentResponseDto> {
    try {
      const created = await this.prisma.department.create({
        data: { key: dto.key, name: dto.name },
        select: DEPARTMENT_SELECT,
      });

      return OrgService.toDepartmentResponse(created);
    } catch (error) {
      throw OrgService.mapPrismaError(error, 'department', dto.key);
    }
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto): Promise<DepartmentResponseDto> {
    await this.assertDepartmentExists(id);

    const updated = await this.prisma.department.update({
      where: { id },
      data: { name: dto.name, isActive: dto.isActive },
      select: DEPARTMENT_SELECT,
    });

    return OrgService.toDepartmentResponse(updated);
  }

  async listBranches(): Promise<BranchResponseDto[]> {
    const rows = await this.prisma.branch.findMany({
      select: BRANCH_SELECT,
      orderBy: { name: 'asc' },
    });

    return rows.map((row) => OrgService.toBranchResponse(row));
  }

  async createBranch(dto: CreateBranchDto): Promise<BranchResponseDto> {
    try {
      const created = await this.prisma.branch.create({
        data: { key: dto.key, name: dto.name, city: dto.city },
        select: BRANCH_SELECT,
      });

      return OrgService.toBranchResponse(created);
    } catch (error) {
      throw OrgService.mapPrismaError(error, 'branch', dto.key);
    }
  }

  async updateBranch(id: string, dto: UpdateBranchDto): Promise<BranchResponseDto> {
    await this.assertBranchExists(id);

    const updated = await this.prisma.branch.update({
      where: { id },
      data: { name: dto.name, city: dto.city, isActive: dto.isActive },
      select: BRANCH_SELECT,
    });

    return OrgService.toBranchResponse(updated);
  }

  private async assertDepartmentExists(id: string): Promise<void> {
    const exists = await this.prisma.department.findUnique({ where: { id }, select: { id: true } });

    if (!exists) {
      throw new NotFoundException('Department not found.');
    }
  }

  private async assertBranchExists(id: string): Promise<void> {
    const exists = await this.prisma.branch.findUnique({ where: { id }, select: { id: true } });

    if (!exists) {
      throw new NotFoundException('Branch not found.');
    }
  }

  private static mapPrismaError(error: unknown, kind: 'department' | 'branch', key: string): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException(`A ${kind} with the key ${key} already exists.`);
    }

    return error instanceof Error ? error : new Error('Unknown persistence error');
  }

  private static toDepartmentResponse(department: SelectedDepartment): DepartmentResponseDto {
    return {
      id: department.id,
      key: department.key,
      name: department.name,
      isActive: department.isActive,
      createdAt: department.createdAt.toISOString(),
    };
  }

  private static toBranchResponse(branch: SelectedBranch): BranchResponseDto {
    return {
      id: branch.id,
      key: branch.key,
      name: branch.name,
      city: branch.city,
      isActive: branch.isActive,
      createdAt: branch.createdAt.toISOString(),
    };
  }
}
