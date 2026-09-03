interface StatCardProps {
  value: number;
  label: string;
  color?: 'default' | 'red' | 'green';
}

const StatCard = ({ value, label, color = 'default' }: StatCardProps) => {
  const colorClasses = {
    default: 'text-gray-900',
    red: 'text-red-600',
    green: 'text-green-600',
  };

  return (
    <div className="text-center">
      <div className={`text-3xl font-semibold ${colorClasses[color]}`}>
        {value}
      </div>
      <div className="text-sm text-gray-600 mt-1">{label}</div>
    </div>
  );
};

export default StatCard;
