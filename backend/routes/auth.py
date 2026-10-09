from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, set_access_cookies, unset_jwt_cookies
from models import db, User
from extensions import limiter
import re

auth_bp = Blueprint('auth', __name__)

EMAIL_REGEX = r'^\S+@\S+\.\S+$'
PHONE_REGEX = r'^\+?[0-9]{10,15}$'

@auth_bp.route('/signup', methods=['POST'])
@limiter.limit("10 per minute")
def signup():
    data = request.get_json() or {}
    name = data.get('name')
    email = data.get('email')
    phone = data.get('phone')
    password = data.get('password')
    profile_image = data.get('profile_image')
    if not all(isinstance(v, str) for v in (name, email, phone, password)):
        return jsonify({'error': 'Name, email, phone and password must be text'}), 400
    name, email, phone = name.strip(), email.strip().lower(), phone.strip()
    
    if not name or not email or not phone or not password:
        return jsonify({'error': 'Missing required fields'}), 400
        
    if not re.match(EMAIL_REGEX, email):
        return jsonify({'error': 'Invalid email format'}), 400
        
    if not re.match(PHONE_REGEX, phone):
        return jsonify({'error': 'Invalid phone number format (should be 10-15 digits)'}), 400
        
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters long'}), 400
    if len(name) > 100 or len(email) > 120:
        return jsonify({'error': 'Name or email exceeds the maximum length'}), 400
        
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 400
        
    user = User(name=name, email=email, phone=phone, profile_image=profile_image)
    user.set_password(password)
    
    db.session.add(user)
    db.session.commit()
    
    access_token = create_access_token(identity=str(user.id))
    response = jsonify({
        'message': 'User registered successfully',
        'user': user.to_dict(),
        'access_token': access_token
    })
    
    # Set JWT in cookies if client is configured for cookies
    set_access_cookies(response, access_token)
    return response, 201

@auth_bp.route('/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')

    if not isinstance(email, str) or not isinstance(password, str):
        return jsonify({'error': 'Email and password must be text'}), 400
    email = email.strip().lower()
    
    if not email or not password:
        return jsonify({'error': 'Email and password required'}), 400
        
    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid credentials'}), 401
    if not user.is_active:
        return jsonify({'error': 'Account has been deactivated'}), 403
        
    access_token = create_access_token(identity=str(user.id))
    response = jsonify({
        'message': 'Logged in successfully',
        'user': user.to_dict(),
        'access_token': access_token
    })
    set_access_cookies(response, access_token)
    return response, 200

@auth_bp.route('/logout', methods=['POST'])
def logout():
    response = jsonify({'message': 'Logged out successfully'})
    unset_jwt_cookies(response)
    return response, 200

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(user.to_dict()), 200

@auth_bp.route('/account', methods=['DELETE'])
@jwt_required()
def delete_account():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if not user.is_active:
        return jsonify({'error': 'Account already deactivated'}), 400
    user.is_active = False
    db.session.commit()
    response = jsonify({'message': 'Account deactivated successfully'})
    unset_jwt_cookies(response)
    return response, 200

@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({'error': 'User not found'}), 404
    data = request.get_json() or {}
    upi_id = data.get('upi_id')
    if 'name' in data:
        if not isinstance(data['name'], str) or not data['name'].strip() or len(data['name']) > 100:
            return jsonify({'error': 'Name must contain 1–100 characters'}), 400
    if 'phone' in data:
        if not isinstance(data['phone'], str) or not re.fullmatch(PHONE_REGEX, data['phone'].strip()):
            return jsonify({'error': 'Phone must contain 10–15 digits, with optional +'}), 400
    if upi_id is not None and (not isinstance(upi_id, str) or len(upi_id) > 100 or (upi_id.strip() and not re.fullmatch(r'[A-Za-z0-9._-]+@[A-Za-z0-9.-]+', upi_id.strip()))):
        return jsonify({'error': 'Enter a valid UPI ID, such as name@bank'}), 400
    upi_id = upi_id.strip() or None if isinstance(upi_id, str) else None
    user.upi_id = upi_id
    if 'name' in data:
        user.name = data['name'].strip()
    if 'phone' in data:
        user.phone = data['phone'].strip()
    db.session.commit()
    return jsonify({
        'message': 'Profile updated successfully',
        'user': user.to_dict()
    }), 200
