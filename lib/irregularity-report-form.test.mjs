import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeIrregularityReport } from './irregularity-report-form.ts';

test('maps stored report aliases into the approved irregularity form', () => {
  const result = normalizeIrregularityReport({
    id: 'FC56AE27',
    reference_number: 'FC56AE27',
    date_of_event: '2026-06-11T05:00:00.000Z',
    reporting_branch: 'CGK',
    airlines: 'Garuda Indonesia',
    flight_number: 'GA824',
    route: 'CGK-SIN',
    category: 'Complaint',
    severity: 'HIGH',
    description: 'Customer online complaint',
    root_caused: 'Baggage handling error',
    immediate_action: 'Coordinate with baggage team',
    remarks_gapura_kps: 'Perform final baggage reconciliation',
    reporter_name: 'Melisa',
    evidence_urls: ['one', 'two'],
  });

  assert.equal(result.reference_no, 'FC56AE27');
  assert.equal(result.incident_date, '2026-06-11');
  assert.equal(result.subject, 'Garuda Indonesia GA824 - Complaint - HIGH');
  assert.equal(result.attachment, '2 Files');
  assert.deepEqual(result.officers[0], {
    name: 'Melisa',
    company: 'Gapura Angkasa',
    function: 'Reporter',
  });
  assert.deepEqual(result.chronology[0], { time: '', description: 'Customer online complaint' });
  assert.equal(result.root_cause, 'Baggage handling error');
  assert.equal(result.action_taken, 'Coordinate with baggage team');
  assert.equal(result.preventive_action, 'Perform final baggage reconciliation');
});

test('keeps missing optional form values safe and visible', () => {
  const result = normalizeIrregularityReport({ created_at: '2026-07-16', id: 'legacy-report' });
  assert.equal(result.doc_title, 'IRREGULARITY REPORT FORM');
  assert.equal(result.aircraft_reg, '-');
  assert.equal(result.route, '-');
  assert.equal(result.delay, 'No Delay / -');
  assert.deepEqual(result.officers, []);
  assert.deepEqual(result.chronology, []);
});
