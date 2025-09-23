export type PatrolCategory = 'lobinhos' | 'escoteiros' | 'seniors'

export type Patrol = {
  id: string
  name: string
  category: PatrolCategory
  total_points?: number
}

export type MemberRole = 'lobinhos' | 'escoteiros' | 'seniors' | 'pioneiros' | 'chefe'

export type Member = {
  id: string
  display_name: string
  patrol_id: string | null
  role: MemberRole
  is_youth: boolean // legado; não usamos mais na UI
}

export type Activity = {
  id: string
  title: string
  date: string
  created_by: string | null
}
