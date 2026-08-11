import { createPortal } from 'react-dom'

export default function DropdownPortal({ children }) {
  return createPortal(children, document.body)
}
