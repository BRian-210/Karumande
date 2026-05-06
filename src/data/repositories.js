const bcrypt = require('bcryptjs');
const { getDB } = require('../config/db');

function db() {
  return getDB();
}

async function query(text, params = []) {
  return db().query(text, params);
}

async function withTransaction(callback) {
  const client = await db().connect();
  try {
    await client.query('begin');
    const result = await callback(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    passwordHash: row.password_hash,
    role: row.role,
    children: Array.isArray(row.children) ? row.children : [],
    passwordResetToken: row.password_reset_token,
    passwordResetExpires: row.password_reset_expires,
    isActive: row.is_active,
    mustChangePassword: row.must_change_password,
    lastLoginAt: row.last_login_at,
    failedLoginAttempts: row.failed_login_attempts,
    lockedUntil: row.locked_until,
    profilePhoto: row.profile_photo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStudent(row) {
  if (!row) return null;
  const student = {
    id: row.id,
    _id: row.id,
    name: row.name,
    admissionNumber: row.admission_number,
    classLevel: row.class_level,
    stream: row.stream,
    gender: row.gender,
    dob: row.dob ? new Date(row.dob) : null,
    parent: row.parent_id || null,
    status: row.status,
    active: row.active,
    photo: row.photo,
    previousSchool: row.previous_school,
    medicalInfo: row.medical_info,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (row.parent_name || row.parent_email || row.parent_role || row.parent_phone) {
    student.parent = {
      id: row.parent_id,
      _id: row.parent_id,
      name: row.parent_name,
      email: row.parent_email,
      phone: row.parent_phone,
      role: row.parent_role,
    };
  }

  return student;
}

function mapAdmission(row) {
  if (!row) return null;
  const photo = typeof row.photo === 'string' ? JSON.parse(row.photo) : row.photo;
  const admission = {
    id: row.id,
    _id: row.id,
    parentName: row.parent_name,
    phone: row.phone,
    email: row.email,
    relationship: row.relationship,
    studentName: row.student_name,
    gender: row.gender,
    dob: row.dob ? new Date(row.dob) : null,
    classApplied: row.class_applied,
    previousSchool: row.previous_school,
    medicalInfo: row.medical_info,
    photo,
    birthCertificate: row.birth_certificate,
    transferLetter: row.transfer_letter,
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    student: row.student_id,
    admissionNumber: row.admission_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (row.reviewed_by_name || row.reviewed_by_email) {
    admission.reviewedBy = {
      id: row.reviewed_by,
      _id: row.reviewed_by,
      name: row.reviewed_by_name,
      email: row.reviewed_by_email,
    };
  }

  if (row.linked_student_name || row.linked_student_class_level || row.linked_student_admission_number) {
    admission.student = {
      id: row.student_id,
      _id: row.student_id,
      name: row.linked_student_name,
      admissionNumber: row.linked_student_admission_number,
      classLevel: row.linked_student_class_level,
      gender: row.linked_student_gender,
      dob: row.linked_student_dob ? new Date(row.linked_student_dob) : null,
      photo: row.linked_student_photo,
    };
  }

  return admission;
}

function mapBill(row) {
  if (!row) return null;
  const bill = {
    id: row.id,
    _id: row.id,
    student: row.student_id,
    term: row.term,
    description: row.description,
    amount: Number(row.amount),
    amountPaid: Number(row.amount_paid),
    balance: Number(row.balance),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.student_name || row.student_class_level || row.student_parent_id) {
    bill.student = {
      id: row.student_id,
      _id: row.student_id,
      name: row.student_name,
      classLevel: row.student_class_level,
      parent: row.student_parent_id,
    };
  }
  return bill;
}

function mapPayment(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    student: row.student_id ? {
      id: row.student_id,
      _id: row.student_id,
      name: row.student_name,
      classLevel: row.student_class_level,
      parent: row.student_parent_id,
    } : row.student_id,
    bill: row.bill_id ? {
      id: row.bill_id,
      _id: row.bill_id,
      term: row.bill_term,
    } : row.bill_id,
    transactionId: row.transaction_id,
    merchantRequestId: row.merchant_request_id,
    checkoutRequestId: row.checkout_request_id,
    phone: row.phone,
    amount: Number(row.amount),
    status: row.status,
    rawCallback: row.raw_callback,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapResult(row) {
  if (!row) return null;
  const result = {
    id: row.id,
    _id: row.id,
    student: row.student_id,
    term: row.term,
    subjects: Array.isArray(row.subjects) ? row.subjects : [],
    total: row.total === null ? null : Number(row.total),
    grade: row.grade,
    comments: row.comments,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.student_name || row.student_class_level || row.student_admission_number) {
    result.student = {
      id: row.student_id,
      _id: row.student_id,
      name: row.student_name,
      classLevel: row.student_class_level,
      parent: row.student_parent_id,
      admissionNumber: row.student_admission_number,
    };
  }
  return result;
}

function mapAnnouncement(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    title: row.title,
    body: row.body,
    audience: row.audience,
    startDate: row.start_date,
    endDate: row.end_date,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFeeStructure(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    classLevel: row.class_level,
    term: row.term,
    amount: Number(row.amount),
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapContentBlock(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    key: row.key,
    value: row.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGalleryImage(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    uploadedBy: row.uploaded_by,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapResultDueDate(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    classLevel: row.class_level,
    term: row.term,
    subject: row.subject,
    dueDate: row.due_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSiteConfig(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    key: row.key,
    value: row.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const users = {
  async findById(id, options = {}) {
    const includePasswordHash = options.includePasswordHash === true;
    const result = await query(
      `select * from public.users where id = $1 limit 1`,
      [id]
    );
    const user = mapUser(result.rows[0]);
    if (!user) return null;
    if (!includePasswordHash) delete user.passwordHash;
    return user;
  },

  async findByEmail(email, options = {}) {
    const includePasswordHash = options.includePasswordHash === true;
    const result = await query(
      `select * from public.users where lower(email) = lower($1) limit 1`,
      [email]
    );
    const user = mapUser(result.rows[0]);
    if (!user) return null;
    if (!includePasswordHash) delete user.passwordHash;
    return user;
  },

  // ✅ NEW: Added for password reset
   async findByResetToken(token) {
    if (!token) return null;

    const result = await query(
      `SELECT * FROM public.users 
       WHERE password_reset_token = $1 
         AND password_reset_expires > NOW() 
         AND is_active = true 
       LIMIT 1`,
      [token]
    );

    const user = mapUser(result.rows[0]);
    return user;
  },

  async create(data, client = null) {
    const executor = client || db();
    const passwordHash = await bcrypt.hash(data.passwordHash, 12);
    const result = await executor.query(
      `insert into public.users (
         name, email, phone, password_hash, role, children, is_active, 
         must_change_password, profile_photo
       ) values ($1, lower($2), $3, $4, $5, $6::jsonb, $7, $8, $9)
       returning *`,
      [
        data.name,
        data.email,
        data.phone || null,
        passwordHash,
        data.role || 'student',
        JSON.stringify(data.children || []),
        data.isActive !== false,
        data.mustChangePassword === true,
        data.profilePhoto || null,
      ]
    );
    return mapUser(result.rows[0]);
  },

  async update(id, patch, client = null) {
    const executor = client || db();
    const fields = [];
    const values = [id];
    let index = 2;

    const map = {
      name: 'name',
      email: 'email',
      phone: 'phone',
      role: 'role',
      children: 'children',
      isActive: 'is_active',
      mustChangePassword: 'must_change_password',
      profilePhoto: 'profile_photo',
      password_reset_token: 'password_reset_token',
      password_reset_expires: 'password_reset_expires',
    };

    for (const [key, column] of Object.entries(map)) {
      if (patch[key] !== undefined) {
        fields.push(`${column} = $${index}`);
        values.push(key === 'children' ? JSON.stringify(patch[key] || []) : patch[key]);
        index += 1;
      }
    }

    if (fields.length === 0) return this.findById(id);

    const result = await executor.query(
      `update public.users
       set ${fields.join(', ')}
       where id = $1
       returning *`,
      values
    );
    return mapUser(result.rows[0]);
  },
  async countActiveAdmins() {
    const result = await query(
      `select count(*)::int as count
       from public.users
       where role = 'admin' and is_active = true`
    );
    return result.rows[0]?.count || 0;
  },

  async updateLastLogin(id, client = null) {
    const executor = client || db();
    await executor.query(
      `update public.users
       set last_login_at = now()
       where id = $1`,
      [id]
    );
  },

  async updatePassword(id, newPassword, options = {}, client = null) {
    const executor = client || db();
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const result = await executor.query(
      `update public.users
       set password_hash = $2,
           must_change_password = $3
       where id = $1
       returning *`,
      [id, passwordHash, options.mustChangePassword === true]
    );
    return mapUser(result.rows[0]);
  },

  async update(id, patch, client = null) {
    const executor = client || db();
    const fields = [];
    const values = [id];
    let index = 2;
    const map = {
      name: 'name',
      email: 'email',
      phone: 'phone',
      role: 'role',
      children: 'children',
      isActive: 'is_active',
      mustChangePassword: 'must_change_password',
      profilePhoto: 'profile_photo',
    };
    for (const [key, column] of Object.entries(map)) {
      if (patch[key] !== undefined) {
        fields.push(`${column} = $${index}`);
        values.push(key === 'children' ? JSON.stringify(patch[key] || []) : patch[key]);
        index += 1;
      }
    }
    if (patch.passwordHash !== undefined) {
      fields.push(`password_hash = $${index}`);
      values.push(await bcrypt.hash(patch.passwordHash, 12));
      index += 1;
    }
    if (fields.length === 0) {
      return this.findById(id, { includePasswordHash: true });
    }
    const result = await executor.query(
      `update public.users
       set ${fields.join(', ')}
       where id = $1
       returning *`,
      values
    );
    return mapUser(result.rows[0]);
  },

  async addChild(parentId, studentId, client = null) {
    const executor = client || db();
    const current = await executor.query(`select children from public.users where id = $1`, [parentId]);
    const children = Array.isArray(current.rows[0]?.children) ? current.rows[0].children : [];
    if (!children.includes(studentId)) {
      children.push(studentId);
      await executor.query(`update public.users set children = $2::jsonb where id = $1`, [
        parentId,
        JSON.stringify(children),
      ]);
    }
  },
};

const students = {
  async findById(id, options = {}) {
    const withParent = options.withParent === true;
    const result = await query(
      `select s.*,
              u.id as parent_id,
              u.name as parent_name,
              u.email as parent_email,
              u.phone as parent_phone,
              u.role as parent_role
       from public.students s
       left join public.users u on u.id = s.parent_id
       where s.id = $1
       limit 1`,
      [id]
    );
    const student = mapStudent(result.rows[0]);
    if (!student) return null;
    if (!withParent && student.parent && typeof student.parent === 'object') {
      student.parent = student.parent.id;
    }
    return student;
  },

  async findByAdmissionNumber(admissionNumber) {
    const result = await query(
      `select *
       from public.students
       where admission_number = $1
       limit 1`,
      [admissionNumber]
    );
    return mapStudent(result.rows[0]);
  },

  async list(filters = {}) {
    const values = [];
    const where = [];
    let index = 1;

    if (filters.active !== undefined) {
      where.push(`s.active = $${index++}`);
      values.push(filters.active);
    }
    if (filters.parentId) {
      where.push(`s.parent_id = $${index++}`);
      values.push(filters.parentId);
    }
    if (filters.classLevel) {
      where.push(`s.class_level = $${index++}`);
      values.push(filters.classLevel);
    }
    if (filters.studentId) {
      where.push(`s.id = $${index++}`);
      values.push(filters.studentId);
    }
    if (filters.search) {
      where.push(`(s.name ilike $${index} or coalesce(s.admission_number, '') ilike $${index})`);
      values.push(`%${filters.search}%`);
      index += 1;
    }
    if (filters.ids?.length) {
      where.push(`s.id = any($${index}::uuid[])`);
      values.push(filters.ids);
      index += 1;
    }

    const orderBy = filters.orderBy || 's.name asc';
    const limit = Number.isFinite(filters.limit) ? ` limit ${Number(filters.limit)}` : '';
    const offset = Number.isFinite(filters.offset) ? ` offset ${Number(filters.offset)}` : '';
    const result = await query(
      `select s.*,
              u.id as parent_id,
              u.name as parent_name,
              u.email as parent_email,
              u.phone as parent_phone,
              u.role as parent_role
       from public.students s
       left join public.users u on u.id = s.parent_id
       ${where.length ? `where ${where.join(' and ')}` : ''}
       order by ${orderBy}${limit}${offset}`,
      values
    );
    return result.rows.map(mapStudent);
  },

  async count(filters = {}) {
    const values = [];
    const where = [];
    let index = 1;
    if (filters.active !== undefined) {
      where.push(`active = $${index++}`);
      values.push(filters.active);
    }
    if (filters.parentId) {
      where.push(`parent_id = $${index++}`);
      values.push(filters.parentId);
    }
    if (filters.classLevel) {
      where.push(`class_level = $${index++}`);
      values.push(filters.classLevel);
    }
    if (filters.search) {
      where.push(`(name ilike $${index} or coalesce(admission_number, '') ilike $${index})`);
      values.push(`%${filters.search}%`);
      index += 1;
    }
    if (filters.ids?.length) {
      where.push(`id = any($${index}::uuid[])`);
      values.push(filters.ids);
      index += 1;
    }
    const result = await query(
      `select count(*)::int as count
       from public.students
       ${where.length ? `where ${where.join(' and ')}` : ''}`,
      values
    );
    return result.rows[0]?.count || 0;
  },

  async create(data, client = null) {
    const executor = client || db();
    const result = await executor.query(
      `insert into public.students (
         name, admission_number, class_level, stream, gender, dob, parent_id, status, active, photo, previous_school, medical_info
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       returning *`,
      [
        data.name,
        data.admissionNumber || null,
        data.classLevel,
        data.stream || null,
        data.gender,
        data.dob,
        data.parent || null,
        data.status || 'active',
        data.active !== false,
        data.photo || null,
        data.previousSchool || null,
        data.medicalInfo || null,
      ]
    );
    return mapStudent(result.rows[0]);
  },

  async update(id, patch, client = null) {
    const executor = client || db();
    const fields = [];
    const values = [id];
    let index = 2;
    const map = {
      name: 'name',
      admissionNumber: 'admission_number',
      classLevel: 'class_level',
      stream: 'stream',
      gender: 'gender',
      dob: 'dob',
      parent: 'parent_id',
      status: 'status',
      active: 'active',
      photo: 'photo',
      previousSchool: 'previous_school',
      medicalInfo: 'medical_info',
    };
    Object.entries(map).forEach(([key, column]) => {
      if (patch[key] !== undefined) {
        fields.push(`${column} = $${index++}`);
        values.push(patch[key]);
      }
    });
    if (!fields.length) return this.findById(id);
    const result = await executor.query(
      `update public.students
       set ${fields.join(', ')}
       where id = $1
       returning *`,
      values
    );
    return mapStudent(result.rows[0]);
  },

  async distinctIdsByParent(parentId) {
    const result = await query(`select id from public.students where parent_id = $1`, [parentId]);
    return result.rows.map((row) => row.id);
  },

  async summaryCounts(year) {
    const result = await query(
      `select
         count(*) filter (where active = true)::int as total,
         count(*) filter (where active = true and gender = 'Male')::int as boys,
         count(*) filter (where active = true and gender = 'Female')::int as girls,
         count(*) filter (
           where active = true
             and created_at >= make_timestamptz($1, 1, 1, 0, 0, 0)
             and created_at < make_timestamptz($1 + 1, 1, 1, 0, 0, 0)
         )::int as new_this_year
       from public.students`,
      [year]
    );
    return result.rows[0];
  },

  async byGrade() {
    const result = await query(
      `select class_level, gender, count(*)::int as count
       from public.students
       where active = true
       group by class_level, gender`
    );
    return result.rows;
  },
};

const announcements = {
  async listActive({ audience, limit, offset }) {
    const values = [new Date()];
    let where = `where active = true
      and (start_date is null or start_date <= $1)
      and (end_date is null or end_date >= $1)`;
    if (audience) {
      values.push(audience);
      where += ` and audience = $${values.length}`;
    }
    const items = await query(
      `select *
       from public.announcements
       ${where}
       order by created_at desc
       limit ${Number(limit)} offset ${Number(offset)}`,
      values
    );
    const total = await query(
      `select count(*)::int as count
       from public.announcements
       ${where}`,
      values
    );
    return { items: items.rows.map(mapAnnouncement), total: total.rows[0]?.count || 0 };
  },
  async create(data) {
    const result = await query(
      `insert into public.announcements (title, body, audience, start_date, end_date, active)
       values ($1, $2, $3, $4, $5, coalesce($6, true))
       returning *`,
      [data.title, data.body, data.audience || 'public', data.startDate || null, data.endDate || null, data.active]
    );
    return mapAnnouncement(result.rows[0]);
  },
  async update(id, patch) {
    const fields = [];
    const values = [id];
    let index = 2;
    const map = { title: 'title', body: 'body', audience: 'audience', startDate: 'start_date', endDate: 'end_date', active: 'active' };
    Object.entries(map).forEach(([key, column]) => {
      if (patch[key] !== undefined) {
        fields.push(`${column} = $${index++}`);
        values.push(patch[key]);
      }
    });
    if (!fields.length) {
      const existing = await query(`select * from public.announcements where id = $1 limit 1`, [id]);
      return mapAnnouncement(existing.rows[0]);
    }
    const result = await query(`update public.announcements set ${fields.join(', ')} where id = $1 returning *`, values);
    return mapAnnouncement(result.rows[0]);
  },
  async delete(id) {
    const result = await query(`delete from public.announcements where id = $1 returning *`, [id]);
    return mapAnnouncement(result.rows[0]);
  },
};

const feeStructures = {
  async list() {
    const result = await query(`select * from public.fee_structures order by class_level asc, term asc`);
    return result.rows.map(mapFeeStructure);
  },
  async findOne({ classLevel, term }) {
    const result = await query(`select * from public.fee_structures where class_level = $1 and term = $2 limit 1`, [classLevel, term]);
    return mapFeeStructure(result.rows[0]);
  },
  async findAnyByClass(classLevel) {
    const result = await query(`select * from public.fee_structures where class_level = $1 order by updated_at desc limit 1`, [classLevel]);
    return mapFeeStructure(result.rows[0]);
  },
  async create(data) {
    const result = await query(
      `insert into public.fee_structures (class_level, term, amount, description)
       values ($1, $2, $3, $4)
       returning *`,
      [data.classLevel, data.term, data.amount, data.description || null]
    );
    return mapFeeStructure(result.rows[0]);
  },
  async update(id, patch) {
    const fields = [];
    const values = [id];
    let index = 2;
    if (patch.amount !== undefined) {
      fields.push(`amount = $${index++}`);
      values.push(patch.amount);
    }
    if (patch.description !== undefined) {
      fields.push(`description = $${index++}`);
      values.push(patch.description);
    }
    const result = await query(`update public.fee_structures set ${fields.join(', ')} where id = $1 returning *`, values);
    return mapFeeStructure(result.rows[0]);
  },
};

const contentBlocks = {
  async findByKey(key) {
    const result = await query(`select * from public.content_blocks where key = $1 limit 1`, [key]);
    return mapContentBlock(result.rows[0]);
  },
  async upsert(key, value) {
    const result = await query(
      `insert into public.content_blocks (key, value)
       values ($1, $2)
       on conflict (key) do update set value = excluded.value
       returning *`,
      [key, value]
    );
    return mapContentBlock(result.rows[0]);
  },
};

const galleryImages = {
  async listActive() {
    const result = await query(
      `select * from public.gallery_images where active = true order by created_at desc`
    );
    return result.rows.map(mapGalleryImage);
  },
  async create(data) {
    const result = await query(
      `insert into public.gallery_images (title, description, image_url, uploaded_by, active)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [data.title || null, data.description || null, data.imageUrl, data.uploadedBy || null, data.active !== false]
    );
    return mapGalleryImage(result.rows[0]);
  },
  async update(id, patch) {
    const fields = [];
    const values = [id];
    let index = 2;
    const map = { title: 'title', description: 'description', imageUrl: 'image_url', uploadedBy: 'uploaded_by', active: 'active' };
    Object.entries(map).forEach(([key, column]) => {
      if (patch[key] !== undefined) {
        fields.push(`${column} = $${index++}`);
        values.push(patch[key]);
      }
    });
    if (!fields.length) {
      const existing = await query(`select * from public.gallery_images where id = $1 limit 1`, [id]);
      return mapGalleryImage(existing.rows[0]);
    }
    const result = await query(`update public.gallery_images set ${fields.join(', ')} where id = $1 returning *`, values);
    return mapGalleryImage(result.rows[0]);
  },
};

const siteConfigs = {
  async list() {
    const result = await query(`select * from public.site_configs order by key asc`);
    return result.rows.map(mapSiteConfig);
  },
  async findByKey(key) {
    const result = await query(`select * from public.site_configs where key = $1 limit 1`, [key]);
    return mapSiteConfig(result.rows[0]);
  },
  async upsert(key, value) {
    const result = await query(
      `insert into public.site_configs (key, value)
       values ($1, $2)
       on conflict (key) do update set value = excluded.value
       returning *`,
      [key, value]
    );
    return mapSiteConfig(result.rows[0]);
  },
};

const resultDueDates = {
  async findList(filters = {}) {
    const where = [];
    const values = [];
    let index = 1;
    if (filters.classLevel !== undefined) {
      where.push(`class_level ${filters.classLevel === null ? 'is null' : `= $${index++}`}`);
      if (filters.classLevel !== null) values.push(filters.classLevel);
    }
    if (filters.term) {
      where.push(`term = $${index++}`);
      values.push(filters.term);
    }
    if (filters.subject !== undefined) {
      where.push(`subject ${filters.subject === null ? 'is null' : `= $${index++}`}`);
      if (filters.subject !== null) values.push(filters.subject);
    }
    if (filters.subjects?.length) {
      where.push(`subject = any($${index++}::text[])`);
      values.push(filters.subjects);
    }
    const result = await query(
      `select *
       from public.result_due_dates
       ${where.length ? `where ${where.join(' and ')}` : ''}
       order by due_date asc`,
      values
    );
    return result.rows.map(mapResultDueDate);
  },
  async findOne(filters = {}) {
    const items = await this.findList(filters);
    return items[0] || null;
  },
  async upsert({ classLevel = null, term, subject = null, dueDate, createdBy }) {
    const result = await query(
      `insert into public.result_due_dates (class_level, term, subject, due_date, created_by)
       values ($1, $2, $3, $4, $5)
       on conflict (class_level, term, subject)
       do update set due_date = excluded.due_date, created_by = excluded.created_by
       returning *`,
      [classLevel, term, subject, dueDate, createdBy]
    );
    return mapResultDueDate(result.rows[0]);
  },
  async delete(id) {
    const result = await query(`delete from public.result_due_dates where id = $1 returning *`, [id]);
    return mapResultDueDate(result.rows[0]);
  },
};

const bills = {
  async list(filters = {}) {
    const values = [];
    const where = [];
    let index = 1;
    if (filters.studentIds?.length) {
      where.push(`b.student_id = any($${index++}::uuid[])`);
      values.push(filters.studentIds);
    }
    if (filters.studentId) {
      where.push(`b.student_id = $${index++}`);
      values.push(filters.studentId);
    }
    if (filters.term) {
      where.push(`b.term = $${index++}`);
      values.push(filters.term);
    }
    const result = await query(
      `select b.*,
              s.name as student_name,
              s.class_level as student_class_level,
              s.parent_id as student_parent_id
       from public.bills b
       left join public.students s on s.id = b.student_id
       ${where.length ? `where ${where.join(' and ')}` : ''}
       order by b.updated_at desc
       ${Number.isFinite(filters.limit) ? `limit ${Number(filters.limit)}` : ''}
       ${Number.isFinite(filters.offset) ? `offset ${Number(filters.offset)}` : ''}`,
      values
    );
    return result.rows.map(mapBill);
  },
  async count(filters = {}) {
    const values = [];
    const where = [];
    let index = 1;
    if (filters.studentIds?.length) {
      where.push(`student_id = any($${index++}::uuid[])`);
      values.push(filters.studentIds);
    }
    if (filters.studentId) {
      where.push(`student_id = $${index++}`);
      values.push(filters.studentId);
    }
    if (filters.term) {
      where.push(`term = $${index++}`);
      values.push(filters.term);
    }
    const result = await query(
      `select count(*)::int as count from public.bills ${where.length ? `where ${where.join(' and ')}` : ''}`,
      values
    );
    return result.rows[0]?.count || 0;
  },
  async findById(id) {
    const result = await query(
      `select b.*,
              s.name as student_name,
              s.class_level as student_class_level,
              s.parent_id as student_parent_id
       from public.bills b
       left join public.students s on s.id = b.student_id
       where b.id = $1
       limit 1`,
      [id]
    );
    return mapBill(result.rows[0]);
  },
  async findOne(filters = {}) {
    const list = await this.list({ ...filters, limit: 1, offset: 0 });
    return list[0] || null;
  },
  async create(data, client = null) {
    const executor = client || db();
    const result = await executor.query(
      `insert into public.bills (student_id, term, description, amount, amount_paid, balance, status)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning *`,
      [
        data.student,
        data.term || null,
        data.description || null,
        data.amount,
        data.amountPaid || 0,
        data.balance ?? data.amount,
        data.status || 'pending',
      ]
    );
    return mapBill(result.rows[0]);
  },
  async update(id, patch, client = null) {
    const executor = client || db();
    const fields = [];
    const values = [id];
    let index = 2;
    const map = { student: 'student_id', term: 'term', description: 'description', amount: 'amount', amountPaid: 'amount_paid', balance: 'balance', status: 'status' };
    Object.entries(map).forEach(([key, column]) => {
      if (patch[key] !== undefined) {
        fields.push(`${column} = $${index++}`);
        values.push(patch[key]);
      }
    });
    if (!fields.length) {
      return this.findById(id);
    }
    const result = await executor.query(`update public.bills set ${fields.join(', ')} where id = $1 returning *`, values);
    return mapBill(result.rows[0]);
  },
};

const payments = {
  async list(filters = {}) {
    const values = [];
    const where = [];
    let index = 1;
    if (filters.studentIds?.length) {
      where.push(`p.student_id = any($${index++}::uuid[])`);
      values.push(filters.studentIds);
    }
    if (filters.studentId) {
      where.push(`p.student_id = $${index++}`);
      values.push(filters.studentId);
    }
    if (filters.billId) {
      where.push(`p.bill_id = $${index++}`);
      values.push(filters.billId);
    }
    const result = await query(
      `select p.*,
              s.name as student_name,
              s.class_level as student_class_level,
              s.parent_id as student_parent_id,
              b.term as bill_term
       from public.payments p
       left join public.students s on s.id = p.student_id
       left join public.bills b on b.id = p.bill_id
       ${where.length ? `where ${where.join(' and ')}` : ''}
       order by p.created_at desc
       ${Number.isFinite(filters.limit) ? `limit ${Number(filters.limit)}` : ''}
       ${Number.isFinite(filters.offset) ? `offset ${Number(filters.offset)}` : ''}`,
      values
    );
    return result.rows.map(mapPayment);
  },
  async count(filters = {}) {
    const values = [];
    const where = [];
    let index = 1;
    if (filters.studentIds?.length) {
      where.push(`student_id = any($${index++}::uuid[])`);
      values.push(filters.studentIds);
    }
    if (filters.studentId) {
      where.push(`student_id = $${index++}`);
      values.push(filters.studentId);
    }
    if (filters.billId) {
      where.push(`bill_id = $${index++}`);
      values.push(filters.billId);
    }
    const result = await query(`select count(*)::int as count from public.payments ${where.length ? `where ${where.join(' and ')}` : ''}`, values);
    return result.rows[0]?.count || 0;
  },
  async findById(id) {
    const result = await query(
      `select p.*,
              s.name as student_name,
              s.class_level as student_class_level,
              s.parent_id as student_parent_id,
              b.term as bill_term
       from public.payments p
       left join public.students s on s.id = p.student_id
       left join public.bills b on b.id = p.bill_id
       where p.id = $1
       limit 1`,
      [id]
    );
    return mapPayment(result.rows[0]);
  },
  async create(data, client = null) {
    const executor = client || db();
    const result = await executor.query(
      `insert into public.payments (student_id, bill_id, transaction_id, merchant_request_id, checkout_request_id, phone, amount, status, raw_callback)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning *`,
      [
        data.student || null,
        data.bill || null,
        data.transactionId || null,
        data.merchantRequestId || null,
        data.checkoutRequestId || null,
        data.phone || null,
        data.amount,
        data.status || 'pending',
        data.rawCallback || null,
      ]
    );
    return mapPayment(result.rows[0]);
  },
  async update(id, patch, client = null) {
    const executor = client || db();
    const fields = [];
    const values = [id];
    let index = 2;
    const map = {
      student: 'student_id',
      bill: 'bill_id',
      transactionId: 'transaction_id',
      merchantRequestId: 'merchant_request_id',
      checkoutRequestId: 'checkout_request_id',
      phone: 'phone',
      amount: 'amount',
      status: 'status',
      rawCallback: 'raw_callback',
    };
    Object.entries(map).forEach(([key, column]) => {
      if (patch[key] !== undefined) {
        fields.push(`${column} = $${index++}`);
        values.push(patch[key]);
      }
    });
    if (!fields.length) {
      return this.findById(id);
    }
    const result = await executor.query(`update public.payments set ${fields.join(', ')} where id = $1 returning *`, values);
    return mapPayment(result.rows[0]);
  },
  async upsertByCheckoutRequestId(checkoutRequestId, patch, client = null) {
    const executor = client || db();
    const result = await executor.query(
      `insert into public.payments (checkout_request_id, merchant_request_id, transaction_id, status, amount, raw_callback, student_id, bill_id, phone)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (checkout_request_id) do update
         set merchant_request_id = excluded.merchant_request_id,
             transaction_id = excluded.transaction_id,
             status = excluded.status,
             amount = coalesce(excluded.amount, public.payments.amount),
             raw_callback = excluded.raw_callback
       returning *`,
      [
        checkoutRequestId,
        patch.merchantRequestId || null,
        patch.transactionId || null,
        patch.status || 'pending',
        patch.amount ?? null,
        patch.rawCallback || null,
        patch.student || null,
        patch.bill || null,
        patch.phone || null,
      ]
    );
    return mapPayment(result.rows[0]);
  },
};

const resultsRepo = {
  async list(filters = {}) {
    const values = [];
    const where = [];
    let index = 1;
    if (filters.term) {
      where.push(`r.term = $${index++}`);
      values.push(filters.term);
    }
    if (filters.studentId) {
      where.push(`r.student_id = $${index++}`);
      values.push(filters.studentId);
    }
    if (filters.studentIds?.length) {
      where.push(`r.student_id = any($${index++}::uuid[])`);
      values.push(filters.studentIds);
    }
    const result = await query(
      `select r.*,
              s.name as student_name,
              s.class_level as student_class_level,
              s.parent_id as student_parent_id,
              s.admission_number as student_admission_number
       from public.results r
       left join public.students s on s.id = r.student_id
       ${where.length ? `where ${where.join(' and ')}` : ''}
       order by r.created_at desc
       ${Number.isFinite(filters.limit) ? `limit ${Number(filters.limit)}` : ''}
       ${Number.isFinite(filters.offset) ? `offset ${Number(filters.offset)}` : ''}`,
      values
    );
    return result.rows.map(mapResult);
  },
  async count(filters = {}) {
    const values = [];
    const where = [];
    let index = 1;
    if (filters.term) {
      where.push(`term = $${index++}`);
      values.push(filters.term);
    }
    if (filters.studentId) {
      where.push(`student_id = $${index++}`);
      values.push(filters.studentId);
    }
    if (filters.studentIds?.length) {
      where.push(`student_id = any($${index++}::uuid[])`);
      values.push(filters.studentIds);
    }
    const result = await query(`select count(*)::int as count from public.results ${where.length ? `where ${where.join(' and ')}` : ''}`, values);
    return result.rows[0]?.count || 0;
  },
  async findById(id) {
    const result = await query(
      `select r.*,
              s.name as student_name,
              s.class_level as student_class_level,
              s.parent_id as student_parent_id,
              s.admission_number as student_admission_number
       from public.results r
       left join public.students s on s.id = r.student_id
       where r.id = $1
       limit 1`,
      [id]
    );
    return mapResult(result.rows[0]);
  },
  async findOne(filters = {}) {
    const list = await this.list({ ...filters, limit: 1, offset: 0 });
    return list[0] || null;
  },
  async upsert(data, client = null) {
    const executor = client || db();
    const result = await executor.query(
      `insert into public.results (student_id, term, subjects, total, grade, comments)
       values ($1, $2, $3::jsonb, $4, $5, $6)
       on conflict (student_id, term) do update
         set subjects = excluded.subjects,
             total = excluded.total,
             grade = excluded.grade,
             comments = excluded.comments
       returning *`,
      [
        data.student,
        data.term,
        JSON.stringify(data.subjects || []),
        data.total ?? null,
        data.grade || null,
        data.comments || null,
      ]
    );
    return mapResult(result.rows[0]);
  },
  async update(id, patch, client = null) {
    const executor = client || db();
    const fields = [];
    const values = [id];
    let index = 2;
    if (patch.subjects !== undefined) {
      fields.push(`subjects = $${index++}::jsonb`);
      values.push(JSON.stringify(patch.subjects || []));
    }
    if (patch.total !== undefined) {
      fields.push(`total = $${index++}`);
      values.push(patch.total);
    }
    if (patch.grade !== undefined) {
      fields.push(`grade = $${index++}`);
      values.push(patch.grade);
    }
    if (patch.comments !== undefined) {
      fields.push(`comments = $${index++}`);
      values.push(patch.comments);
    }
    if (!fields.length) {
      return this.findById(id);
    }
    const result = await executor.query(`update public.results set ${fields.join(', ')} where id = $1 returning *`, values);
    return mapResult(result.rows[0]);
  },
};

const admissions = {
  async create(data, client = null) {
    const executor = client || db();
    const photoValue = typeof data.photo === 'string'
      ? { original: data.photo, thumbnail: null, medium: null }
      : data.photo;
    const result = await executor.query(
      `insert into public.admissions (
         parent_name, phone, email, relationship, student_name, gender, dob, class_applied,
         previous_school, medical_info, photo, birth_certificate, transfer_letter, status, submitted_at
       ) values ($1, $2, lower($3), $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15)
       returning *`,
      [
        data.parentName,
        data.phone,
        data.email,
        data.relationship || null,
        data.studentName,
        data.gender || 'other',
        data.dob || null,
        data.classApplied || null,
        data.previousSchool || null,
        data.medicalInfo || null,
        JSON.stringify(photoValue || { original: null, thumbnail: null, medium: null }),
        data.birthCertificate || null,
        data.transferLetter || null,
        data.status || 'pending',
        data.submittedAt || new Date(),
      ]
    );
    return mapAdmission(result.rows[0]);
  },
  async list(filters = {}) {
    const values = [];
    const where = [];
    let index = 1;
    if (filters.withStudent === true) {
      where.push(`a.student_id is not null`);
    }
    if (filters.status && filters.status !== 'all') {
      where.push(`a.status = $${index++}`);
      values.push(filters.status);
    }
    if (filters.classApplied) {
      where.push(`a.class_applied = $${index++}`);
      values.push(filters.classApplied);
    }
    if (filters.id) {
      where.push(`a.id = $${index++}`);
      values.push(filters.id);
    }
    const result = await query(
      `select a.*,
              reviewer.name as reviewed_by_name,
              reviewer.email as reviewed_by_email,
              s.name as linked_student_name,
              s.admission_number as linked_student_admission_number,
              s.class_level as linked_student_class_level,
              s.gender as linked_student_gender,
              s.dob as linked_student_dob,
              s.photo as linked_student_photo
       from public.admissions a
       left join public.users reviewer on reviewer.id = a.reviewed_by
       left join public.students s on s.id = a.student_id
       ${where.length ? `where ${where.join(' and ')}` : ''}
       order by a.submitted_at desc
       ${Number.isFinite(filters.limit) ? `limit ${Number(filters.limit)}` : ''}
       ${Number.isFinite(filters.offset) ? `offset ${Number(filters.offset)}` : ''}`,
      values
    );
    return result.rows.map(mapAdmission);
  },
  async count(filters = {}) {
    const values = [];
    const where = [];
    let index = 1;
    if (filters.status && filters.status !== 'all') {
      where.push(`status = $${index++}`);
      values.push(filters.status);
    }
    const result = await query(`select count(*)::int as count from public.admissions ${where.length ? `where ${where.join(' and ')}` : ''}`, values);
    return result.rows[0]?.count || 0;
  },
  async findById(id) {
    const list = await this.list({ id, limit: 1, offset: 0 });
    return list[0] || null;
  },
    async update(id, patch, client = null) {
    const executor = client || db();
    const fields = [];
    const values = [id];
    let index = 2;

    const map = {
      name: 'name',
      email: 'email',
      phone: 'phone',
      role: 'role',
      children: 'children',
      isActive: 'is_active',
      mustChangePassword: 'must_change_password',
      profilePhoto: 'profile_photo',
      password_reset_token: 'password_reset_token',
      password_reset_expires: 'password_reset_expires',
    };

    for (const [key, column] of Object.entries(map)) {
      if (patch[key] !== undefined) {
        fields.push(`${column} = $${index}`);
        values.push(key === 'children' ? JSON.stringify(patch[key] || []) : patch[key]);
        index += 1;
      }
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    const result = await executor.query(
      `UPDATE public.users 
       SET ${fields.join(', ')} 
       WHERE id = $1 
       RETURNING *`,
      values
    );

    return mapUser(result.rows[0]);
  },
};
module.exports = {
  withTransaction,
  query,
  users,
  students,
  announcements,
  admissions,
  bills,
  payments,
  results: resultsRepo,
  resultDueDates,
  feeStructures,
  contentBlocks,
  galleryImages,
  siteConfigs,
};