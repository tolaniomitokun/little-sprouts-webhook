const express = require('express');
const app = express();
app.use(express.json());

// ============================================
// MOCK DATA - Little Sprouts Pediatrics
// ============================================

const AVAILABLE_SLOTS = {
  today: [
    { time: "2:30 PM", provider: "Dr. Sofia Reyes", available: true },
    { time: "3:15 PM", provider: "Dr. James Patel", available: true },
    { time: "4:00 PM", provider: "Dr. Sofia Reyes", available: true },
    { time: "4:30 PM", provider: "Dr. Amanda Liu", available: true },
  ],
  tomorrow: [
    { time: "9:00 AM", provider: "Dr. Amanda Liu", available: true },
    { time: "9:30 AM", provider: "Dr. Sofia Reyes", available: true },
    { time: "10:30 AM", provider: "Dr. Sofia Reyes", available: true },
    { time: "11:00 AM", provider: "Dr. James Patel", available: true },
    { time: "2:00 PM", provider: "Dr. James Patel", available: true },
    { time: "3:00 PM", provider: "Dr. Amanda Liu", available: true },
  ]
};

const bookedAppointments = [];

// ============================================
// WEBHOOK ENDPOINT
// ============================================

app.post('/vapi-webhook', async (req, res) => {
  console.log('\n========== INCOMING VAPI REQUEST ==========');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  const { message } = req.body;
  
  if (message?.type === 'function-call') {
    const functionName = message.functionCall?.name;
    const parameters = message.functionCall?.parameters || {};
    
    console.log(`\n>>> Function Called: ${functionName}`);
    console.log('>>> Parameters:', JSON.stringify(parameters, null, 2));
    
    let result;
    
    switch (functionName) {
      case 'check_availability':
        result = handleCheckAvailability(parameters);
        break;
      case 'book_appointment':
        result = handleBookAppointment(parameters);
        break;
      case 'flag_urgent':
        result = handleFlagUrgent(parameters);
        break;
      default:
        result = { result: "I'm sorry, I couldn't process that request." };
    }
    
    console.log('>>> Response:', JSON.stringify(result, null, 2));
    return res.json(result);
  }
  
  res.json({ result: "OK" });
});

// ============================================
// FUNCTION HANDLERS
// ============================================

function handleCheckAvailability(params) {
  const { preferred_date, time_preference, provider_preference } = params;
  
  console.log(`\n--- Checking Availability ---`);
  console.log(`Date: ${preferred_date}, Time: ${time_preference}, Provider: ${provider_preference}`);
  
  let day = 'today';
  if (preferred_date) {
    const dateLower = preferred_date.toLowerCase();
    if (dateLower.includes('tomorrow')) {
      day = 'tomorrow';
    }
  }
  
  let slots = [...AVAILABLE_SLOTS[day]];
  
  if (provider_preference) {
    const providerLower = provider_preference.toLowerCase();
    slots = slots.filter(slot => 
      slot.provider.toLowerCase().includes(providerLower) ||
      slot.provider.toLowerCase().includes(providerLower.replace('doctor ', 'dr. ').replace('dr ', 'dr. '))
    );
  }
  
  if (time_preference === 'morning') {
    slots = slots.filter(slot => slot.time.includes('AM'));
  } else if (time_preference === 'afternoon') {
    slots = slots.filter(slot => slot.time.includes('PM'));
  }
  
  slots = slots.filter(slot => slot.available).slice(0, 3);
  
  if (slots.length === 0) {
    const alternativeDay = day === 'today' ? 'tomorrow' : 'today';
    return {
      result: `I don't have any openings ${day} with those preferences. Would you like me to check ${alternativeDay} instead, or a different doctor?`
    };
  }
  
  const slotDescriptions = slots.map(s => `${s.time} with ${s.provider}`);
  
  if (slots.length === 1) {
    return {
      result: `I have one opening ${day}: ${slotDescriptions[0]}. Would that work for you?`
    };
  }
  
  return {
    result: `Great news! I have a few openings ${day}: ${slotDescriptions.slice(0, -1).join(', ')}, or ${slotDescriptions.slice(-1)}. Which works best for you?`
  };
}

function handleBookAppointment(params) {
  const { 
    child_name, 
    child_dob, 
    parent_name, 
    phone, 
    appointment_datetime, 
    provider, 
    reason_for_visit 
  } = params;
  
  console.log(`\n--- Booking Appointment ---`);
  console.log(`Child: ${child_name}, Parent: ${parent_name}`);
  console.log(`Time: ${appointment_datetime}, Provider: ${provider}`);
  
  const appointment = {
    id: `APT-${Date.now()}`,
    child_name,
    child_dob,
    parent_name,
    phone,
    appointment_datetime,
    provider,
    reason_for_visit,
    booked_at: new Date().toISOString(),
    status: 'confirmed'
  };
  
  bookedAppointments.push(appointment);
  
  console.log(`\n✅ APPOINTMENT BOOKED!`);
  console.log('Record:', JSON.stringify(appointment, null, 2));
  
  const childFirstName = child_name?.split(' ')[0] || 'your child';
  
  return {
    result: `Perfect! I've got ${childFirstName} all set for ${appointment_datetime} with ${provider}. We'll send a text confirmation to ${phone}. When you arrive, just check in at our kiosk. Is there anything else I can help with?`
  };
}

function handleFlagUrgent(params) {
  const { symptoms, severity, recommendation } = params;
  
  console.log(`\n🚨 URGENT CASE FLAGGED 🚨`);
  console.log(`Symptoms: ${symptoms}`);
  console.log(`Severity: ${severity}`);
  
  const responses = {
    call_911: `This sounds like an emergency. Please hang up and call 911 right away, or go directly to the nearest emergency room.`,
    emergency_room: `Based on what you're describing, I recommend going to the emergency room right away. They can help faster than we can.`,
    nurse_line: `I want to connect you with our nurse right away. Please hold for just a moment.`,
    same_day_appointment: `Let me get your child in right away — I'm looking for the very next available slot.`
  };
  
  return {
    result: responses[recommendation] || responses.nurse_line
  };
}

// ============================================
// UTILITY ENDPOINTS
// ============================================

app.get('/', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'Little Sprouts Pediatrics - Voice Agent Webhook',
    timestamp: new Date().toISOString(),
    appointments_booked: bookedAppointments.length
  });
});

app.get('/appointments', (req, res) => {
  res.json({
    total: bookedAppointments.length,
    appointments: bookedAppointments
  });
});

app.get('/availability', (req, res) => {
  res.json(AVAILABLE_SLOTS);
});

app.post('/reset', (req, res) => {
  bookedAppointments.length = 0;
  res.json({ message: 'Appointments cleared', count: 0 });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🏥 Little Sprouts Webhook Server Running!`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`\nReady to receive calls from Vapi...\n`);
});
