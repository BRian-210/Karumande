create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text,
  password_hash text not null,
  role text not null default 'student' check (role in ('admin', 'parent', 'teacher', 'student')),
  children jsonb not null default '[]'::jsonb,
  password_reset_token text,
  password_reset_expires timestamptz,
  is_active boolean not null default true,
  must_change_password boolean not null default false,
  last_login_at timestamptz,
  failed_login_attempts integer not null default 0,
  locked_until timestamptz,
  profile_photo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_role on public.users(role);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  admission_number text unique,
  class_level text not null,
  stream text,
  gender text not null check (gender in ('Male', 'Female', 'Other')),
  dob date not null,
  parent_id uuid references public.users(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'graduated', 'transferred', 'suspended')),
  active boolean not null default true,
  photo text,
  previous_school text,
  medical_info text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_students_parent_id on public.students(parent_id);
create index if not exists idx_students_class_active on public.students(class_level, active);

create table if not exists public.admissions (
  id uuid primary key default gen_random_uuid(),
  parent_name text not null,
  phone text not null,
  email text not null,
  relationship text,
  student_name text not null,
  gender text not null default 'other' check (gender in ('male', 'female', 'other')),
  dob date,
  class_applied text,
  previous_school text,
  medical_info text,
  photo jsonb not null default '{"original":null,"thumbnail":null,"medium":null}'::jsonb,
  birth_certificate text,
  transfer_letter text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id) on delete set null,
  student_id uuid references public.students(id) on delete set null,
  admission_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  term text,
  description text,
  amount numeric(12, 2) not null check (amount >= 0),
  amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0),
  balance numeric(12, 2) not null default 0 check (balance >= 0),
  status text not null default 'pending' check (status in ('pending', 'partial', 'paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete set null,
  bill_id uuid references public.bills(id) on delete set null,
  transaction_id text unique,
  merchant_request_id text,
  checkout_request_id text,
  phone text,
  amount numeric(12, 2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  raw_callback jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_merchant_request_id on public.payments(merchant_request_id);
create index if not exists idx_payments_checkout_request_id on public.payments(checkout_request_id);

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  term text not null,
  subjects jsonb not null default '[]'::jsonb,
  total numeric(8, 2),
  grade text,
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, term)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null default 'public' check (audience in ('public', 'parents', 'students', 'staff')),
  start_date timestamptz,
  end_date timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_blocks (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fee_structures (
  id uuid primary key default gen_random_uuid(),
  class_level text not null,
  term text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(class_level, term)
);

create table if not exists public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  title text,
  description text,
  image_url text not null,
  uploaded_by uuid references public.users(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.result_due_dates (
  id uuid primary key default gen_random_uuid(),
  class_level text,
  term text not null,
  subject text,
  due_date timestamptz not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (class_level, term, subject)
);

create table if not exists public.site_configs (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at before update on public.users for each row execute function public.set_updated_at();

drop trigger if exists set_students_updated_at on public.students;
create trigger set_students_updated_at before update on public.students for each row execute function public.set_updated_at();

drop trigger if exists set_admissions_updated_at on public.admissions;
create trigger set_admissions_updated_at before update on public.admissions for each row execute function public.set_updated_at();

drop trigger if exists set_bills_updated_at on public.bills;
create trigger set_bills_updated_at before update on public.bills for each row execute function public.set_updated_at();

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at before update on public.payments for each row execute function public.set_updated_at();

drop trigger if exists set_results_updated_at on public.results;
create trigger set_results_updated_at before update on public.results for each row execute function public.set_updated_at();

drop trigger if exists set_announcements_updated_at on public.announcements;
create trigger set_announcements_updated_at before update on public.announcements for each row execute function public.set_updated_at();

drop trigger if exists set_content_blocks_updated_at on public.content_blocks;
create trigger set_content_blocks_updated_at before update on public.content_blocks for each row execute function public.set_updated_at();

drop trigger if exists set_fee_structures_updated_at on public.fee_structures;
create trigger set_fee_structures_updated_at before update on public.fee_structures for each row execute function public.set_updated_at();

drop trigger if exists set_gallery_images_updated_at on public.gallery_images;
create trigger set_gallery_images_updated_at before update on public.gallery_images for each row execute function public.set_updated_at();

drop trigger if exists set_result_due_dates_updated_at on public.result_due_dates;
create trigger set_result_due_dates_updated_at before update on public.result_due_dates for each row execute function public.set_updated_at();

drop trigger if exists set_site_configs_updated_at on public.site_configs;
create trigger set_site_configs_updated_at before update on public.site_configs for each row execute function public.set_updated_at();
