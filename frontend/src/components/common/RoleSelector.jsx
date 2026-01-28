import { 
  FormControl, 
  FormLabel, 
  RadioGroup, 
  FormControlLabel, 
  Radio,
  FormHelperText,
  Paper
} from '@mui/material';
import { Gavel, AdminPanelSettings } from '@mui/icons-material';
import { ROLE_CONFIG, ROLES } from '../../utils/constants';

const roleIcons = {
  [ROLES.LAWYER]: Gavel,
  [ROLES.ADMIN]: AdminPanelSettings,
};

const RoleSelector = ({ value, onChange, error, disabled = false }) => {
  return (
    <FormControl fullWidth error={!!error} sx={{ mb: { xs: 2, sm: 2.5 } }}>
      <FormLabel 
        sx={{ 
          mb: 2,
          fontWeight: 600,
          fontSize: '15px',
          color: '#333',
          '&.Mui-focused': { color: '#667eea' } 
        }}
      >
        Select Your Role
      </FormLabel>
      
      <RadioGroup
        value={value}
        onChange={onChange}
        sx={{ gap: { xs: 1.25, sm: 1.5 } }}
      >
        {Object.entries(ROLE_CONFIG).map(([roleKey, config]) => {
          const IconComponent = roleIcons[roleKey];
          const isSelected = value === roleKey;
          
          return (
            <Paper
              key={roleKey}
              elevation={isSelected ? 3 : 0}
              className={`
                cursor-pointer transition-all duration-200 rounded-xl overflow-hidden
                ${isSelected ? 'ring-2' : 'border border-gray-200 hover:border-gray-300'}
                ${disabled ? 'opacity-50 pointer-events-none' : ''}
              `}
              sx={{
                ringColor: config.color,
                backgroundColor: isSelected ? config.bgColor : '#fff',
              }}
            >
              <FormControlLabel
                value={roleKey}
                disabled={disabled}
                control={
                  <Radio 
                    sx={{
                      color: config.color,
                      '&.Mui-checked': {
                        color: config.color,
                      },
                    }}
                  />
                }
                label={
                  <div className="flex items-center gap-3 py-1">
                    <div 
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: isSelected ? config.color : config.bgColor }}
                    >
                      <IconComponent 
                        sx={{ 
                          color: isSelected ? '#fff' : config.color,
                          fontSize: 24 
                        }} 
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800" style={{ fontSize: '15px' }}>{config.label}</p>
                      <p className="text-sm text-gray-500" style={{ marginTop: '2px' }}>{config.description}</p>
                    </div>
                  </div>
                }
                sx={{
                  m: 0,
                  p: { xs: 1.5, sm: 2 },
                  width: '100%',
                  '& .MuiFormControlLabel-label': {
                    flex: 1,
                  },
                }}
              />
            </Paper>
          );
        })}
      </RadioGroup>
      
      {error && (
        <FormHelperText 
          className="animate-fadeIn ml-2 mt-2"
          sx={{ color: '#d32f2f' }}
        >
          {error.message}
        </FormHelperText>
      )}
    </FormControl>
  );
};

export default RoleSelector;
