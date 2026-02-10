const Usage = require('../models/Usage')

// Return CSV for usages (basic implementation)
exports.exportUsagesCSV = async (req, res) => {
  try {
    const { start, end, resource } = req.query
    const filter = { userId: req.userId }
    if (resource) filter.resource_type = resource
    if (start || end) filter.usage_date = {}
    if (start) filter.usage_date.$gte = new Date(start)
    if (end) filter.usage_date.$lte = new Date(end)

    const usages = await Usage.find(filter).sort({ usage_date: -1 })

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="usages.csv"')

    // header
    res.write('resource_type,usage_value,usage_date,notes\n')
    for (const u of usages) {
      const line = `${u.resource_type},${u.usage_value},${u.usage_date.toISOString()},"${(u.notes||'').replace(/"/g,'""')}"\n`
      res.write(line)
    }
    res.end()
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
