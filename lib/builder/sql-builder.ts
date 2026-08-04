
import type {
  QueryDefinition,
} from '@/types/builder';
import { isValidField, isValidTable, getJoinDef } from './schema';

export function validateQuery(def: QueryDefinition): string[] {
  const errors: string[] = [];

  if (!def.source) {
    errors.push('Sumber tabel harus dipilih');
    return errors;
  }

  if (!isValidTable(def.source)) {
    errors.push(`Tabel "${def.source}" tidak valid`);
    return errors;
  }

  const dimensions = def.dimensions || [];
  const measures = def.measures || [];
  const filters = def.filters || [];
  const joins = def.joins || [];

  if (dimensions.length === 0 && measures.length === 0) {
    errors.push('Pilih minimal satu dimensi atau ukuran');
  }

  const validTables = new Set<string>([def.source]);
  for (const join of joins) {
    const joinDef = getJoinDef(join.joinKey);
    if (!joinDef) {
      errors.push(`Join "${join.joinKey}" tidak ditemukan`);
    } else {
      validTables.add(joinDef.to);
    }
  }

  for (const dim of dimensions) {
    if (!validTables.has(dim.table)) {
      errors.push(`Tabel dimensi "${dim.table}" belum di-join`);
    } else if (!isValidField(dim.table, dim.field)) {
      errors.push(`Field "${dim.table}.${dim.field}" tidak valid`);
    }
  }

  for (const m of measures) {
    if (!validTables.has(m.table)) {
      errors.push(`Tabel ukuran "${m.table}" belum di-join`);
    } else if (!isValidField(m.table, m.field)) {
      errors.push(`Field "${m.table}.${m.field}" tidak valid`);
    }
  }

  for (const f of filters) {
    if (!validTables.has(f.table)) {
      errors.push(`Tabel filter "${f.table}" belum di-join`);
    } else if (!isValidField(f.table, f.field)) {
      errors.push(`Field filter "${f.table}.${f.field}" tidak valid`);
    }
  }

  return errors;
}
