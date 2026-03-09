export const timeAgo = (date) => {
    if (!date) return ''

    const now = new Date()
    const past = new Date(date)
    const seconds = Math.floor((now - past) / 1000)

    if (seconds < 60) return 'just now'

    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`

    const days = Math.floor(hours / 24)
    if (days === 1) {
        return `Yesterday at ${past.toLocaleTimeString([], {
            hour: '2-digit', minute: '2-digit'
        })}`
    }

    if (days < 7) return `${days} days ago`

    return past.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    })
}

export default timeAgo
