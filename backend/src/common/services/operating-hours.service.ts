import { Injectable } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { systemParams } from '../../../drizzle/schema';

@Injectable()
export class OperatingHoursService {
  constructor(private db: DatabaseService) {}

  async isWithinOperatingHours(): Promise<boolean> {
    const rows = await this.db.db
      .select()
      .from(systemParams)
      .where(
        inArray(systemParams.key, [
          'OPERATING_HOURS_START',
          'OPERATING_HOURS_END',
          'OPERATING_DAYS',
        ]),
      );

    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const start = map['OPERATING_HOURS_START'] ?? '08:00';
    const end = map['OPERATING_HOURS_END'] ?? '22:00';
    const days = (map['OPERATING_DAYS'] ?? '1,2,3,4,5,6').split(',').map(Number);

    const now = new Date();
    // JS getDay(): 0=Sun…6=Sat  →  convert to 1=Mon…7=Sun
    const jsDay = now.getDay();
    const day = jsDay === 0 ? 7 : jsDay;

    if (!days.includes(day)) return false;

    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    const current = `${hh}:${mm}`;

    return current >= start && current < end;
  }
}
