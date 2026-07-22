import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { QueryContactsDto } from './dto/query-contacts.dto';
import { ContactsRepository } from './contacts.repository';

@Injectable()
export class ContactsService {
  constructor(private repo: ContactsRepository) {}

  async create(dto: CreateContactDto) {
    const existing = await this.repo.findByNumero(dto.phoneNumber);

    if (existing.length > 0) {
      throw new ConflictException(
        `Contato com numero ${dto.phoneNumber} já existe`,
      );
    }

    const [result] = await this.repo.insert({
      name: dto.name,
      phoneNumber: dto.phoneNumber,
      notes: dto.notes,
      address: dto.address,
      socialMedia: dto.socialMedia,
      owesDebt: dto.owesDebt,
      debtAmount: dto.debtAmount,
    });

    return result;
  }

  async findAll(query: QueryContactsDto) {
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;

    const { rows, total } = await this.repo.findAllPaginated(
      {
        starLevel: query.starLevel,
        engagementStatus: query.engagementStatus,
        somenteSemCooldown: query.somenteSemCooldown,
      },
      pagina,
      limite,
    );

    return {
      data: rows,
      total,
      pagina,
      limite,
    };
  }

  async findOne(id: string) {
    const [contact] = await this.repo.findById(id);

    if (!contact) {
      throw new NotFoundException(`Contato ${id} não encontrado`);
    }

    return contact;
  }

  async update(id: string, dto: UpdateContactDto) {
    await this.findOne(id);

    const updateData: any = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.phoneNumber !== undefined)
      updateData.phoneNumber = dto.phoneNumber;
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.engagementStatus !== undefined)
      updateData.engagementStatus = dto.engagementStatus;
    if (dto.cooldownUntil !== undefined)
      updateData.cooldownUntil = new Date(dto.cooldownUntil);
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.socialMedia !== undefined) updateData.socialMedia = dto.socialMedia;
    if (dto.owesDebt !== undefined) updateData.owesDebt = dto.owesDebt;
    if (dto.debtAmount !== undefined) updateData.debtAmount = dto.debtAmount;

    updateData.updatedAt = new Date();

    const [updated] = await this.repo.update(id, updateData);

    return updated;
  }

  async softDelete(id: string) {
    await this.findOne(id);
    await this.repo.softDelete(id);
    return { message: 'Contato removido com sucesso' };
  }

  async importarCsv(buffer: Buffer) {
    const records: any[] = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    let importados = 0;
    const erros: string[] = [];

    for (const record of records) {
      try {
        const { name, phoneNumber, notes } = record;

        if (!name || !phoneNumber) {
          erros.push(
            `Linha inválida: campos obrigatórios faltando - ${JSON.stringify(record)}`,
          );
          continue;
        }

        if (!/^[0-9]{10,15}$/.test(phoneNumber)) {
          erros.push(
            `Número inválido: ${phoneNumber} para ${name}`,
          );
          continue;
        }

        await this.repo.upsertFromCsv({ name, phoneNumber, notes });
        importados++;
      } catch (err: any) {
        erros.push(`Erro ao importar ${JSON.stringify(record)}: ${err.message}`);
      }
    }

    return { importados, erros };
  }

  async getHistorico(id: string) {
    await this.findOne(id);
    return this.repo.findHistoricoByContatoId(id);
  }

  async updateStatus(id: string, status: string) {
    await this.findOne(id);

    const [updated] = await this.repo.update(id, {
      engagementStatus: status as any,
      updatedAt: new Date(),
    });

    return updated;
  }

  async updateStarLevel(id: string, starLevel: number) {
    await this.findOne(id);

    const [updated] = await this.repo.update(id, {
      starLevel,
      starLevelManual: true,
      updatedAt: new Date(),
    });

    return updated;
  }

  async reiniciarBot(id: string) {
    await this.findOne(id);

    const [updated] = await this.repo.update(id, {
      engagementStatus: 'NOVO',
      cooldownUntil: null,
      updatedAt: new Date(),
    });

    return updated;
  }
}
