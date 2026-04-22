export const getBusinessTypeId = (type) => {
    const map = {
        logistics: 1,
        transportation: 2,
        "delivery services": 3,
        "Construction": 4,
        "Maintenance Services": 5,
        "Rental Services": 6,
        "Public Transport": 7,
        
    };

    return map[type.toLowerCase()] || 1;
};