import assert from 'node:assert/strict';
import test from 'node:test';
import { staffClassroomLabels } from '../../lib/management/staff-classroom-labels.ts';

test('active canonical employment and assignment determine the manager roster classroom', () => {
  const labels = staffClassroomLabels('garden-a',
    [{ id: 'employment-a', staff_id: 'staff-a', status: 'active' }],
    [{ staff_id: 'staff-a', classroom_id: 'class-a', employment_id: 'employment-a', garden_id: 'garden-a', status: 'active' }],
    [{ id: 'class-a', garden_id: 'garden-a', name: 'פרפרים', status: 'active' }]);
  assert.equal(labels.get('staff-a'), 'פרפרים');
});

test('foreign, inactive and unbacked assignments do not become classroom labels', () => {
  const labels = staffClassroomLabels('garden-a',
    [{ id: 'active-a', staff_id: 'staff-a', status: 'active' }, { id: 'ended-a', staff_id: 'staff-a', status: 'ended' }],
    [
      { staff_id: 'staff-a', classroom_id: 'class-a', employment_id: 'active-a', garden_id: 'garden-a', status: 'active' },
      { staff_id: 'staff-a', classroom_id: 'foreign', employment_id: 'active-a', garden_id: 'garden-b', status: 'active' },
      { staff_id: 'staff-a', classroom_id: 'inactive', employment_id: 'active-a', garden_id: 'garden-a', status: 'inactive' },
      { staff_id: 'staff-a', classroom_id: 'ended', employment_id: 'ended-a', garden_id: 'garden-a', status: 'active' },
      { staff_id: 'staff-b', classroom_id: 'class-a', employment_id: 'active-a', garden_id: 'garden-a', status: 'active' }
    ],
    [
      { id: 'class-a', garden_id: 'garden-a', name: 'פרפרים', status: 'active' },
      { id: 'foreign', garden_id: 'garden-b', name: 'חסוי', status: 'active' },
      { id: 'inactive', garden_id: 'garden-a', name: 'סגור', status: 'active' },
      { id: 'ended', garden_id: 'garden-a', name: 'ישן', status: 'active' }
    ]);
  assert.equal(labels.get('staff-a'), 'פרפרים');
  assert.equal(labels.has('staff-b'), false);
});

test('multiple active assignments are deduplicated and stable', () => {
  const labels = staffClassroomLabels('garden-a',
    [{ id: 'employment-a', staff_id: 'staff-a', status: 'active' }],
    [
      { staff_id: 'staff-a', classroom_id: 'class-b', employment_id: 'employment-a', garden_id: 'garden-a', status: 'active' },
      { staff_id: 'staff-a', classroom_id: 'class-a', employment_id: 'employment-a', garden_id: 'garden-a', status: 'active' },
      { staff_id: 'staff-a', classroom_id: 'class-a', employment_id: 'employment-a', garden_id: 'garden-a', status: 'active' }
    ],
    [{ id: 'class-a', garden_id: 'garden-a', name: 'אריות', status: 'active' }, { id: 'class-b', garden_id: 'garden-a', name: 'פרפרים', status: 'active' }]);
  assert.equal(labels.get('staff-a'), 'אריות / פרפרים');
});
