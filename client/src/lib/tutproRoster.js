const FIELD_MAP = {
  scheduleId: 'sid',
  studentId: 'stid',
  groupId: 'gid',
  lessonIds: 'lids',
  paymentStatus: 'ps',
  paymentStatusChangedAt: 'psca',
  paymentStatusHistory: 'psh',
  paymentVerified: 'pv',
  paymentMethod: 'pm',
  paymentTransactionId: 'ptid',
  paymentReceiptLink: 'prl',
  paymentPaidAmount: 'ppa',
  uncountableForPayment: 'ucp',
  isGroup: 'ig',
  duration: 'dur',
  meetLink: 'ml',
  recurringId: 'rid',
  recurringPattern: 'rp',
  seriesIndex: 'six',
  updatedAt: 'ua',
  createdAt: 'ca',
  depositBalance: 'db',
  depositLedger: 'dl',
  plannedPriceUpdates: 'ppu',
  levelHistory: 'lh',
  inactiveHistory: 'ih',
  inactiveUntil: 'iu',
  lastContactDate: 'lcd',
  nextPlannedFocus: 'npf',
  contactInfo: 'ci',
  description: 'desc',
  timestamp: 'ts',
  exportedAt: 'ea',
  payment: 'pay',
};

const REVERSE_FIELD_MAP = Object.fromEntries(
  Object.entries(FIELD_MAP).map(([key, value]) => [value, key])
);

const isRecord = (value) => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const decompressFieldNames = (value) => {
  if (Array.isArray(value)) {
    return value.map(decompressFieldNames);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.entries(value).reduce((acc, [key, entryValue]) => {
    acc[REVERSE_FIELD_MAP[key] || key] = decompressFieldNames(entryValue);
    return acc;
  }, {});
};

export const decompressSnapshotIfNeeded = (snapshot) => {
  if (!isRecord(snapshot)) return snapshot;

  if (snapshot._compression?.compressed) {
    const { _compression, ...rest } = snapshot;
    void _compression;
    return decompressFieldNames(rest);
  }

  return snapshot;
};

export const normalizeStudentId = (value) => String(value || '')
  .trim()
  .replace(/^id\s*[:#-]?\s*/i, '')
  .replace(/\s+/g, '');

export const normalizeStudentName = (value) => String(value || '')
  .normalize('NFKC')
  .replace(/[\u0027\u0060\u00B4\u02BC\u02EE\u055A\u07F4\u07F5\u2018\u2019\u201B\u2032\uA78C\uFF07]/g, "'")
  .toLowerCase()
  .replace(/\s*\(.*\)\s*$/g, '')
  .replace(/\s+[a-c][12]\s*$/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const getTutorData = (snapshot) => {
  const parsedSnapshot = decompressSnapshotIfNeeded(snapshot);

  if (!isRecord(parsedSnapshot)) {
    return {};
  }

  if (isRecord(parsedSnapshot.tutorData)) {
    return parsedSnapshot.tutorData;
  }

  return parsedSnapshot;
};

const pickFirstString = (...values) => {
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (normalized) return normalized;
  }
  return '';
};

export const extractRosterStudents = (snapshot) => {
  const tutorData = getTutorData(snapshot);
  const students = Array.isArray(tutorData.students) ? tutorData.students : [];

  return students
    .map((student, index) => {
      const contactInfo = isRecord(student?.contactInfo) ? student.contactInfo : {};
      const studentId = normalizeStudentId(student?.id);
      const name = pickFirstString(student?.name, student?.displayName, student?.fullName);
      const email = pickFirstString(student?.email, contactInfo?.email).toLowerCase();
      const phone = pickFirstString(student?.phone, contactInfo?.phone, contactInfo?.telegram);
      const guardian = pickFirstString(student?.guardian, student?.guardianName, contactInfo?.guardian);
      const level = pickFirstString(student?.level, student?.gradeLevel);
      const inactiveUntil = pickFirstString(student?.inactiveUntil);

      return {
        id: studentId || `tutpro-${index}`,
        tutproStudentId: studentId,
        name,
        email,
        phone,
        guardian,
        level,
        inactive: Boolean(student?.inactive) || Boolean(inactiveUntil),
        inactiveUntil,
        notes: pickFirstString(student?.notes, student?.description),
        raw: student,
      };
    })
    .filter((student) => student.name || student.email || student.tutproStudentId);
};

export const getProfileTutproStudentId = (profile) => {
  if (!isRecord(profile?.settings)) return '';
  return normalizeStudentId(profile.settings.tutproStudentId);
};

export const buildStudentAppLaunchUrl = ({ baseUrl, teacherId, studentId, studentName }) => {
  const normalizedBaseUrl = String(baseUrl || '').trim().replace(/\/+$/, '');
  const normalizedTeacherId = String(teacherId || '').trim();
  const normalizedStudentId = normalizeStudentId(studentId);
  const normalizedStudentName = String(studentName || '').trim();

  if (!normalizedBaseUrl || !normalizedTeacherId || !normalizedStudentId || !normalizedStudentName) {
    return '';
  }

  try {
    const url = new URL(`${normalizedBaseUrl}/launch/student-app`);
    url.searchParams.set('teacherId', normalizedTeacherId);
    url.searchParams.set('studentId', normalizedStudentId);
    url.searchParams.set('studentName', normalizedStudentName);
    return url.toString();
  } catch {
    return '';
  }
};

/**
 * Verify a student login by scanning lesson_manager_backups for a match.
 * Returns { record, teacherId } or null.
 */
export const verifyStudentLogin = async (supabaseClient, studentId, studentName) => {
  const normId = normalizeStudentId(studentId);
  const normName = normalizeStudentName(studentName);
  if (!normId || !normName) return null;

  // Scan recent backups (like student-app does)
  const { data: rows, error } = await supabaseClient
    .from('lesson_manager_backups')
    .select('snapshot, user_id')
    .order('updated_at', { ascending: false })
    .limit(80);

  if (error || !rows?.length) return null;

  for (const row of rows) {
    if (!row.snapshot) continue;
    const students = extractRosterStudents(row.snapshot);
    // Exact match: ID + Name
    const exact = students.find(
      (s) => normalizeStudentId(s.tutproStudentId) === normId &&
             normalizeStudentName(s.name) === normName
    );
    if (exact) return { record: exact, teacherId: row.user_id };
  }

  // Fallback: name-only across all backups
  for (const row of rows) {
    if (!row.snapshot) continue;
    const students = extractRosterStudents(row.snapshot);
    const nameMatches = students.filter((s) => normalizeStudentName(s.name) === normName);
    if (nameMatches.length === 1) return { record: nameMatches[0], teacherId: row.user_id };
  }

  return null;
};
