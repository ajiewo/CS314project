const express = require('express')
const app = express()
const PORT = process.env.PORT || 5000

const mongoose = require('mongoose')

//connect to database
mongoose.connect('mongodb://localhost/my_database',
      { useNewUrlParser: true, useUnifiedTopology: true })

app.listen(PORT, () => console.log(`Listening on port ${PORT}`))

app.get('/api/data', (req, res) => {
   // Fetch data from MongoDB
   res.json({ message: 'Data fetched successfully' })
})
