export function generatePagesContentRoute(): string {
  return `import { createContentHandler } from '@editable-ui/next'
import { adapter, storage, isAdmin } from '../../../editable.config'

export default createContentHandler({ adapter, storage, isAdmin })
`
}

export function generatePagesUploadRoute(): string {
  return `import { createUploadHandler } from '@editable-ui/next'
import { adapter, storage, isAdmin } from '../../../editable.config'

export const config = {
  api: { bodyParser: { sizeLimit: '14mb' } },
}

export default createUploadHandler({ adapter, storage, isAdmin })
`
}
