import assert from 'node:assert/strict';
import test from 'node:test';
import { canViewReport } from './report-access.ts';

const report = {
  id: 'report-1',
  user_id: 'owner-1',
  station_id: 'CGK',
  reporter_email: 'owner@example.com',
  reporter_name: 'Owner Name',
};

test('staff can only view their own or station-matching reports', () => {
  assert.equal(canViewReport({
    id: 'owner-1', email: 'owner@example.com', role: 'STAFF_CABANG', station_id: 'DPS',
  }, report), true);
  assert.equal(canViewReport({
    id: 'other', email: 'other@example.com', role: 'STAFF_CABANG', station_id: 'CGK',
  }, report), true);
  assert.equal(canViewReport({
    id: 'other', email: 'other@example.com', role: 'STAFF_CABANG', station_id: 'DPS',
  }, report), false);
});

test('branch managers are restricted to their station while elevated roles retain report access', () => {
  assert.equal(canViewReport({
    id: 'manager', email: 'manager@example.com', role: 'MANAGER_CABANG', station_id: 'CGK',
  }, report), true);
  assert.equal(canViewReport({
    id: 'manager', email: 'manager@example.com', role: 'MANAGER_CABANG', station_id: 'DPS',
  }, report), false);
  assert.equal(canViewReport({
    id: 'analyst', email: 'analyst@example.com', role: 'ANALYST',
  }, report), true);
});
