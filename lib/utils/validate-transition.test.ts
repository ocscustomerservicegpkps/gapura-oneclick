import assert from 'node:assert/strict';
import test from 'node:test';
import { canChangeReportStatus, getAllowedTransitions } from '@/lib/constants/report-status';
import { validateStatusTransition } from '@/lib/utils/validate-transition';

const allowedRoles = [
    'SUPER_ADMIN',
    'ANALYST',
    'DIVISI_ESKALASI',
    'DIVISI_OP',
    'DIVISI_OS',
    'DIVISI_OCS',
    'DIVISI_OT',
    'DIVISI_UQ',
    'DIVISI_HC',
    'DIVISI_HT',
];

test('all non-branch roles can change report status', () => {
    for (const role of allowedRoles) {
        assert.equal(canChangeReportStatus(role), true, role);
        assert.deepEqual(getAllowedTransitions('OPEN', role), ['ON PROGRESS', 'CLOSED'], role);
        assert.deepEqual(validateStatusTransition('OPEN', 'close', role), {
            valid: true,
            newStatus: 'CLOSED',
        }, role);
    }
});

test('staff and manager cabang cannot change report status', () => {
    for (const role of ['STAFF_CABANG', 'MANAGER_CABANG']) {
        assert.equal(canChangeReportStatus(role), false, role);
        assert.deepEqual(getAllowedTransitions('OPEN', role), [], role);
        const validation = validateStatusTransition('OPEN', 'close', role);
        assert.equal(validation.valid, false, role);
        assert.match(validation.error || '', /cannot change report status/i, role);
    }
});

test('blank current status behaves as OPEN', () => {
    assert.deepEqual(validateStatusTransition('', 'close', 'ANALYST'), {
        valid: true,
        newStatus: 'CLOSED',
    });
});
