import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'

type DownloadEntry = {
    id: string
    url: string
    title: string
    thumbnail: string
    filePath: string
    createdAt: string
}

type Data = {
    downloads: DownloadEntry[]
}

const adapter = new JSONFile<Data>('db.json')
const defaultData: Data = { downloads: [] }
const db = new Low<Data>(adapter, defaultData);

(async () => {
    await db.read()
    db.data ||= defaultData
    await db.write()
})()

export default db