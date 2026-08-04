const calculateInvoice = (trips = []) => {
  let subtotal = 0;
  let dispatchTotal = 0;

  const updatedTrips = trips.map((trip) => {
    const totalCharges = Number(trip.totalCharges || 0);
    const dispatchPercentage = Number(trip.dispatchPercentage || trip.dispatchPercent || 0);
    
    // Agar direct amount pass kiya gaya hai toh wo, warna percentage calculation
    const dispatchAmount = trip.dispatchAmount !== undefined 
      ? Number(trip.dispatchAmount) 
      : (totalCharges * dispatchPercentage) / 100;

    subtotal += totalCharges;
    dispatchTotal += dispatchAmount;

    return {
      ...trip,
      totalCharges,
      dispatchPercentage,
      dispatchAmount,
    };
  });

  const tax = 0;
  
  // Trip Charges + Dispatch Charges = Grand Total ($300 + $30 = $330)
  const grandTotal = subtotal + dispatchTotal;

  return {
    trips: updatedTrips,
    subtotal,
    dispatchTotal,
    tax,
    grandTotal,
  };
};

module.exports = calculateInvoice;