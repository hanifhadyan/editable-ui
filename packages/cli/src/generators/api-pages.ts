export function generatePagesContentRoute(): string {
  return `import { createContentHandler } from '@editable-ui/next'
import { adapter, isAdmin } from '../../../editable.config'

adapter.initialize()

export default createContentHandler({ adapter, isAdmin })
`
}

export function generatePagesUploadRoute(): string {
  return `import { createUploadHandler } from '@editable-ui/next'
import { storage, isAdmin } from '../../../editable.config'

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
}

export default createUploadHandler({ storage, isAdmin })
`
}
