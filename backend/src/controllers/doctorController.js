const supabase = require('../utils/supabase');

const attachUsers = async (doctors) => {
  if (!doctors.length) return doctors;
  const userIds = [...new Set(doctors.map(d => d.user_id).filter(Boolean))];
  const { data: users } = await supabase.from('users').select('id, first_name, last_name, email, phone').in('id', userIds);
  const userMap = {};
  (users || []).forEach(u => { userMap[u.id] = u; });
  return doctors.map(d => ({ ...d, users: userMap[d.user_id] || null }));
};

// GET /doctors
const getDoctors = async (req, res) => {
  try {
    const { specialty } = req.query;
    let query = supabase.from('doctors').select('id, user_id, specialization, consultation_fee, experience_years, is_active');
    if (specialty) query = query.ilike('specialization', `%${specialty}%`);
    const { data, error } = await query;
    if (error) throw error;
    const doctors = await attachUsers(data || []);
    return res.status(200).json({ doctors });
  } catch (err) {
    console.error('getDoctors error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// GET /doctors/:id
const getDoctorById = async (req, res) => {
  try {
    const { data, error } = await supabase.from('doctors').select('id, user_id, specialization, consultation_fee, experience_years, is_active').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Doctor not found' });
    const [doctor] = await attachUsers([data]);
    return res.status(200).json({ doctor });
  } catch (err) {
    console.error('getDoctorById error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// POST /doctors
const createDoctor = async (req, res) => {
  try {
    const { user_id, specialization, consultation_fee, experience } = req.body;
    if (!user_id || !specialization || consultation_fee === undefined) {
      return res.status(400).json({ error: 'user_id, specialization, and consultation_fee are required' });
    }
    const { data: userRecord, error: userErr } = await supabase.from('users').select('id, role_id').eq('id', user_id).single();
    if (userErr || !userRecord) return res.status(404).json({ error: 'User not found' });
    if (userRecord.role_id !== 2) return res.status(400).json({ error: 'User must have doctor role (role_id=2)' });

    const { data, error } = await supabase.from('doctors').insert({ user_id, specialization, consultation_fee: Number(consultation_fee), experience_years: experience || null }).select('id, user_id, specialization, consultation_fee, experience_years').single();
    if (error) throw error;
    const [doctor] = await attachUsers([data]);
    return res.status(201).json({ message: 'Doctor created', doctor });
  } catch (err) {
    console.error('createDoctor error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// DELETE /doctors/:id
const deleteDoctor = async (req, res) => {
  try {
    const { error } = await supabase.from('doctors').delete().eq('id', req.params.id);
    if (error) throw error;
    return res.status(200).json({ message: 'Doctor deleted' });
  } catch (err) {
    console.error('deleteDoctor error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getDoctors, getDoctorById, createDoctor, deleteDoctor };
