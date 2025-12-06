const express = require('express');
const app = express();
app.use(express.json());

// Port configuration
const PORT = process.env.PORT || 3000;

// ============================================
// MOCK DATA - Little Sprouts Pediatrics
// ============================================

const AVAILABLE_SLOTS = {
  today: [
    { time: "2:30 PM", provider: "Dr. Sofia Reyes" },
    { time: "3:15 PM", provider: "Dr. James Patel" },
    { time: "4:00 PM", provider: "Dr. Sofia Reyes" },
    { time: "4:30 PM", provider: "Dr. Amanda Liu" }
  ],
  tomorrow: [
    { time: "9:00 AM", provider: "Dr. Amanda Liu" },
    { time: "9:30 AM", provider: "Dr. Sofia Reyes" },
    { time: "10:30 AM", provider: "Dr. Sofia Reyes" },
    { time: "11:00 AM", provider: "Dr. James Patel" },
    { time: "2:00 PM", provider: "Dr. James Patel" },
    { time: "3:00 PM", provider: "Dr. Amanda Liu" }
  ]
};

const bookedAppointments = [];

// ============================================
// HELPER FUNCTIONS
// ============================================

function handleCheckAvailability(params) {
  console.log('📅 Checking availability with params:', params);
  
  const { preferred_date, time_preference, provider_preference } = params;
  
  // Determine which day's slots to use
  let slots = [];
  if (preferred_date === 'today' || preferred_date === 'today\'s') {
    slots = AVAILABLE_SLOTS.today;
  } else if (preferred_date === 'tomorrow') {
    slots = AVAILABLE_SLOTS.tomorrow;
  } else {
    // Default to today if unclear
    slots = AVAILABLE_SLOTS.today;
  }
  
  // Filter by time preference
  if (time_preference === 'morning') {
    slots = slots.filter(s => {
      const hour = parseInt(s.time.split(':')[0]);
      const isPM = s.time.includes('PM');
      return !isPM || hour === 12;
    });
  } else if (time_preference === 'afternoon') {
    slots = slots.filter(s => {
      const hour = parseInt(s.time.split(':')[0]);
      const isPM = s.time.includes('PM');
      return isPM && hour !== 12;
    });
  }
  
  // Filter by provider preference if specified
  if (provider_preference) {
    slots = slots.filter(s => 
      s.provider.toLowerCase().includes(provider_preference.toLowerCase())
    );
  }
  
  // Format response for Sophie to read naturally
  if (slots.length === 0) {
    return {
      result: "I don't have any available slots for that time. Would you like to try a different time or day?"
    };
  }
  
  // Create a natural-sounding list of available times
  const timesList = slots.map((s, idx) => {
    if (idx === slots.length - 1 && slots.length > 1) {
      return `or ${s.time} with ${s.provider}`;
    }
    return `${s.time} with ${s.provider}`;
  }).join(', ');
  
  return {
    result: `I have ${timesList}. Which time works best for you?`
  };
}

function handleBookAppointment(params) {
  console.log('✅ Booking appointment with params:', params);
  
  const { 
    selected_time, 
    selected_provider, 
    child_name, 
    parent_name, 
    phone_number, 
    reason_for_visit 
  } = params;
  
  // Store the booking
  const booking = {
    id: `APT-${Date.now()}`,
    time: selected_time,
    provider: selected_provider,
    child: child_name,
    parent: parent_name,
    phone: phone_number,
    reason: reason_for_visit,
    booked_at: new Date().toISOString()
  };
  
  bookedAppointments.push(booking);
  
  console.log('📋 Appointment booked:', booking);
  
  return {
    result: `Perfect! I've scheduled ${child_name} for ${selected_time} with ${selected_provider}. You'll receive a text confirmation at ${phone_number}. Is there anything else I can help you with?`
  };
}

function handleFlagUrgent(params) {
  console.log('🚨 URGENT FLAG:', params);
  
  const { child_name, symptoms, parent_phone } = params;
  
  // In a real system, this would trigger an immediate notification to clinical staff
  return {
    result: `I understand this is urgent. Based on what you've described, I'm going to connect you with our nurse line right away to make sure ${child_name} gets the care they need. Please hold for just a moment.`
  };
}

// ============================================
// WEBHOOK ENDPOINT
// ============================================

app.post('/vapi-webhook', async (req, res) => {
  try {
    console.log('\n========== VAPI WEBHOOK CALLED ==========');
    console.log('Time:', new Date().toISOString());
    
    const { message } = req.body;
    
    // Check if this is a function call
    if (message?.type === 'function-call') {
      const functionName = message.functionCall?.name;
      const parameters = message.functionCall?.parameters || {};
      
      console.log('Function:', functionName);
      console.log('Parameters:', JSON.stringify(parameters, null, 2));
      
      let result;
      
      // Route to the appropriate handler
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
          console.log('❌ Unknown function:', functionName);
          result = {
            result: "I apologize, but I'm having trouble processing that request. Let me connect you with someone who can help."
          };
      }
      
      console.log('Response:', JSON.stringify(result, null, 2));
      console.log('=========================================\n');
      
      // CRITICAL: Return the result in the exact format Vapi expects
      return res.status(200).json(result);
    }
    
    // For non-function-call messages, just acknowledge
    console.log('Non-function message type:', message?.type);
    return res.status(200).json({ status: 'ok' });
    
  } catch (error) {
    console.error('❌ ERROR:', error);
    return res.status(500).json({ 
      result: "I'm sorry, I encountered an error. Let me transfer you to our front desk." 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Little Sprouts Pediatrics - Voice Agent Webhook',
    timestamp: new Date().toISOString(),
    appointments_booked: bookedAppointments.length
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🏥 Little Sprouts Pediatrics Webhook Server');
  console.log(`✅ Server running on port ${PORT}`);
  console.log('📞 Ready to receive calls from Vapi...\n');
});
