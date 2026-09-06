export interface MenuItem {
  icon: string
  label: string
  to?: string
  onClick?: () => void | Promise<void>
  condition?: () => boolean
  danger?: boolean
}

export interface MenuSection {
  id: string
  title: string
  divider?: boolean
  items: MenuItem[]
}
