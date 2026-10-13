import { createClient } from '@supabase/supabase-js'

// ใส่ค่า URL และ Key ที่คัดลอกมาจาก Supabase
const supabaseUrl = 'https://wfpopolzgxbglgmzjafg.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmcG9wb2x6Z3hiZ2xnbXpqYWZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMDg3MDUsImV4cCI6MjEwNDc4NDcwNX0.bU4l7Pn965id_moYgiQqk4tB6zBL-PNeIcdScNxzyKk' // ใส่ Key เต็มๆ ของคุณ

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  console.log('กำลังทดสอบดึงข้อมูลนักเรียน...')
  
  // ดึงข้อมูลจากตาราง students
  const { data, error } = await supabase
    .from('students')
    .select('*')

  if (error) {
    console.error('เกิดข้อผิดพลาด:', error.message)
  } else {
    console.log('ดึงข้อมูลสำเร็จ! รายชื่อนักเรียน:', data)
  }
}

testConnection()