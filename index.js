const express = require('express');
const app = express();
app.use(express.json());

// Port configuration
const PORT = process.env.PORT || 8000;

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
  if (preferred_date === 'today' || preferred_date === "today's") {
    slots = AVAILABLE_SLOTS.today;
  } else if (preferred_date === 'tomorrow') {
    slots = AVAILABLE_SLOTS.tomorrow;
  } else {
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
    return "I don't have any available slots for that time. Would you like to try a different time or day?";
  }
  
  // Create a natural-sounding list of available times
  const timesList = slots.map((s, idx) => {
    if (idx === slots.length - 1 && slots.length > 1) {
      return `or ${s.time} with ${s.provider}`;
    }
    return `${s.time} with ${s.provider}`;
  }).join(', ');
  
  return `I have ${timesList}. Which time works best for you?`;
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
  
  return `Perfect! I've scheduled ${child_name} for ${selected_time} with ${selected_provider}. You'll receive a text confirmation at ${phone_number}. Is there anything else I can help you with?`;
}

function handleFlagUrgent(params) {
  console.log('🚨 URGENT FLAG:', params);
  
  const { child_name } = params;
  
  return `I understand this is urgent. Based on what you've described, I'm going to connect you with our nurse line right away to make sure ${child_name} gets the care they need. Please hold for just a moment.`;
}

// ============================================
// WEBHOOK ENDPOINT
// ============================================

app.post('/vapi-webhook', async (req, res) => {
  try {
    console.log('\n========== VAPI WEBHOOK CALLED ==========');
    console.log('Time:', new Date().toISOString());
    console.log('Full request body:', JSON.stringify(req.body, null, 2));
    
    const { message } = req.body;
    
    // CRITICAL: Vapi uses 'tool-calls' type, not 'function-call'
    if (message?.type === 'tool-calls') {
      const toolCall = message.toolCallList[0];
      const functionName = toolCall.function.name;
      const parameters = toolCall.function.arguments;
      
      console.log('Tool Call ID:', toolCall.id);
      console.log('Function:', functionName);
      console.log('Parameters:', JSON.stringify(parameters, null, 2));
      
      let resultString = "";
      
      // Route to the appropriate handler
      switch (functionName) {
        case 'check_availability':
          resultString = handleCheckAvailability(parameters);
          break;
          
        case 'book_appointment':
          resultString = handleBookAppointment(parameters);
          break;
          
        case 'flag_urgent':
          resultString = handleFlagUrgent(parameters);
          break;
          
        default:
          console.log('❌ Unknown function:', functionName);
          resultString = "I apologize, but I'm having trouble processing that request. Let me connect you with someone who can help.";
      }
      
      // CRITICAL: Vapi expects results array with toolCallId
      const response = {
        results: [{
          toolCallId: toolCall.id,
          result: resultString
        }]
      };
      
      console.log('Response:', JSON.stringify(response, null, 2));
      console.log('=========================================\n');
      
      return res.status(200).json(response);
    }
    
    // For non-tool-call messages, just acknowledge
    console.log('Non-tool-call message type:', message?.type);
    return res.status(200).json({ status: 'ok' });
    
  } catch (error) {
    console.error('❌ ERROR:', error);
    console.error('Stack:', error.stack);
    return res.status(500).json({ 
      error: "Internal server error" 
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
