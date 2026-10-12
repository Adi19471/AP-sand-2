import { Truck } from 'lucide-react';
import { SelectField } from './FormField';
import { VEHICLE_TRIPS } from '../utils/constants';

/**
 * The Vehicle Trip dropdown.
 *
 * Options are exactly the six required by the specification:
 * Trucktor, 8 Tier, 10 Tier, 12 Tier, 14 Tier, 16 Tier.
 * Administrators can narrow (never invent) the list from Settings, which is
 * why `options` is intersected with the canonical constant.
 */
const VehicleTripSelect = ({
  id = 'vehicleTrip',
  label = 'Vehicle Trip',
  value,
  onChange,
  error,
  required = true,
  options,
  placeholder = 'Select vehicle trip',
  includeAllOption = false,
  ...rest
}) => {
  const allowed = Array.isArray(options) && options.length
    ? VEHICLE_TRIPS.filter((trip) => options.includes(trip))
    : VEHICLE_TRIPS;

  const list = allowed.length ? allowed : VEHICLE_TRIPS;

  return (
    <SelectField
      id={id}
      name={id}
      label={label}
      required={required}
      error={error}
      value={value ?? ''}
      onChange={onChange}
      placeholder={includeAllOption ? 'All Vehicle Trips' : placeholder}
      options={list}
      {...rest}
    />
  );
};

export const VehicleTripIcon = Truck;
export default VehicleTripSelect;
