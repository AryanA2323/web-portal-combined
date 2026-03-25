"""
Comprehensive tests for the Vendor Speech Statement feature.

Tests cover:
- Authentication and authorization
- Vendor check assignment validation
- Audio file validation
- Preview endpoint
- Apply endpoint
- Manual text apply endpoint
- Non-regression for existing evidence upload endpoints
"""

import io
import json
from unittest.mock import patch, MagicMock
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.db import connections


User = get_user_model()


class MockTranscriptionResult:
    """Mock result from speech statement service."""

    def __init__(
        self,
        transcript_mr="मराठी मजकूर",
        translation_en="Marathi text",
        detected_language="mr",
        confidence=0.95,
        stt_model="whisper-large-v3",
        translation_model="llama-3.3-70b-versatile",
        provider="groq",
        audio_duration_seconds=45.5,
        provider_metadata=None,
    ):
        self.transcript_mr = transcript_mr
        self.translation_en = translation_en
        self.detected_language = detected_language
        self.confidence = confidence
        self.stt_model = stt_model
        self.translation_model = translation_model
        self.provider = provider
        self.audio_duration_seconds = audio_duration_seconds
        self.provider_metadata = provider_metadata or {}


class VendorStatementTestCase(TestCase):
    """Base test case with common setup for vendor statement tests."""

    @classmethod
    def setUpTestData(cls):
        """Set up test data once for all tests in this class."""
        # Create test users
        cls.admin_user = User.objects.create_user(
            username='testadmin',
            email='admin@test.com',
            password='testpass123',
            role='ADMIN',
        )

        cls.vendor_user = User.objects.create_user(
            username='testvendor',
            email='vendor@test.com',
            password='testpass123',
            role='VENDOR',
        )

        cls.client_user = User.objects.create_user(
            username='testclient',
            email='client@test.com',
            password='testpass123',
            role='CLIENT',
        )

        # Create vendor profile
        from users.models import Vendor
        cls.vendor = Vendor.objects.create(
            user=cls.vendor_user,
            company_name='Test Vendor Co',
            contact_email='vendor@test.com',
        )

        # Create another vendor (not assigned)
        cls.other_vendor_user = User.objects.create_user(
            username='othervendor',
            email='other@test.com',
            password='testpass123',
            role='VENDOR',
        )
        cls.other_vendor = Vendor.objects.create(
            user=cls.other_vendor_user,
            company_name='Other Vendor',
            contact_email='other@test.com',
        )

    def setUp(self):
        """Set up before each test."""
        self.client = Client()

        # Create test case and check in database
        with connections['default'].cursor() as cursor:
            # Create a test case
            cursor.execute("""
                INSERT INTO cases (
                    claim_number, client_name, category, full_case_status
                ) VALUES (
                    'TEST-CLAIM-001', 'Test Client', 'MACT', 'WIP'
                )
                ON CONFLICT DO NOTHING
                RETURNING id
            """)
            row = cursor.fetchone()
            if row:
                self.case_id = row[0]
            else:
                cursor.execute("""
                    SELECT id FROM cases WHERE claim_number = 'TEST-CLAIM-001'
                """)
                self.case_id = cursor.fetchone()[0]

            # Create a claimant check assigned to our vendor
            cursor.execute("""
                INSERT INTO claimant_checks (
                    case_id, assigned_vendor_id, check_status,
                    claimant_name, claimant_contact
                ) VALUES (
                    %s, %s, 'WIP', 'Test Claimant', '1234567890'
                )
                ON CONFLICT DO NOTHING
                RETURNING id
            """, [self.case_id, self.vendor.id])
            row = cursor.fetchone()
            if row:
                self.check_id = row[0]
            else:
                cursor.execute("""
                    SELECT id FROM claimant_checks
                    WHERE case_id = %s AND assigned_vendor_id = %s
                """, [self.case_id, self.vendor.id])
                row = cursor.fetchone()
                self.check_id = row[0] if row else None

    def tearDown(self):
        """Clean up after each test."""
        # Clean up test data
        with connections['default'].cursor() as cursor:
            cursor.execute("DELETE FROM statement_audio_audit WHERE case_id = %s", [self.case_id])
            cursor.execute("DELETE FROM claimant_checks WHERE case_id = %s", [self.case_id])
            cursor.execute("DELETE FROM cases WHERE id = %s", [self.case_id])

    def login_as_vendor(self):
        """Log in as the test vendor."""
        from users.models import AuthToken
        token = AuthToken.objects.create(user=self.vendor_user)
        return token.token

    def login_as_admin(self):
        """Log in as admin."""
        from users.models import AuthToken
        token = AuthToken.objects.create(user=self.admin_user)
        return token.token

    def login_as_client(self):
        """Log in as client user."""
        from users.models import AuthToken
        token = AuthToken.objects.create(user=self.client_user)
        return token.token

    def login_as_other_vendor(self):
        """Log in as other vendor (not assigned to the check)."""
        from users.models import AuthToken
        token = AuthToken.objects.create(user=self.other_vendor_user)
        return token.token

    def create_test_audio_file(self, size_bytes=1000, content_type='audio/m4a'):
        """Create a fake audio file for testing."""
        # Create a simple file-like object
        content = b'FAKE_AUDIO_CONTENT' * (size_bytes // 18 + 1)
        content = content[:size_bytes]
        audio_file = io.BytesIO(content)
        audio_file.name = 'test_audio.m4a'
        audio_file.content_type = content_type
        return audio_file


class TestAuthenticationAndAuthorization(VendorStatementTestCase):
    """Test authentication and authorization for statement endpoints."""

    def test_preview_requires_authentication(self):
        """Test that preview endpoint requires authentication."""
        response = self.client.post(
            f'/api/vendor-check-statement-audio-preview/{self.case_id}/claimant'
        )
        self.assertEqual(response.status_code, 401)

    def test_preview_requires_vendor_role(self):
        """Test that preview endpoint requires VENDOR role."""
        token = self.login_as_admin()
        response = self.client.post(
            f'/api/vendor-check-statement-audio-preview/{self.case_id}/claimant',
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )
        self.assertEqual(response.status_code, 403)

    def test_preview_requires_client_role_rejected(self):
        """Test that CLIENT role is rejected."""
        token = self.login_as_client()
        response = self.client.post(
            f'/api/vendor-check-statement-audio-preview/{self.case_id}/claimant',
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )
        self.assertEqual(response.status_code, 403)

    def test_vendor_not_assigned_rejected(self):
        """Test that vendor not assigned to check is rejected."""
        token = self.login_as_other_vendor()
        audio_file = self.create_test_audio_file()
        response = self.client.post(
            f'/api/vendor-check-statement-audio-preview/{self.case_id}/claimant',
            {'audio': audio_file},
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )
        self.assertEqual(response.status_code, 404)
        data = response.json()
        self.assertIn('not assigned', data.get('error', '').lower())


class TestInputValidation(VendorStatementTestCase):
    """Test input validation for statement endpoints."""

    def test_invalid_check_type_rejected(self):
        """Test that invalid check types are rejected."""
        token = self.login_as_vendor()
        audio_file = self.create_test_audio_file()
        response = self.client.post(
            f'/api/vendor-check-statement-audio-preview/{self.case_id}/invalid_type',
            {'audio': audio_file},
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('unknown check type', data.get('error', '').lower())

    def test_missing_audio_file_rejected(self):
        """Test that missing audio file is rejected."""
        token = self.login_as_vendor()
        response = self.client.post(
            f'/api/vendor-check-statement-audio-preview/{self.case_id}/claimant',
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('no audio', data.get('error', '').lower())

    def test_oversized_file_rejected(self):
        """Test that oversized audio files are rejected."""
        token = self.login_as_vendor()
        # Create a file larger than 15MB
        large_file = self.create_test_audio_file(size_bytes=16 * 1024 * 1024)
        response = self.client.post(
            f'/api/vendor-check-statement-audio-preview/{self.case_id}/claimant',
            {'audio': large_file},
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('too large', data.get('error', '').lower())


class TestPreviewEndpoint(VendorStatementTestCase):
    """Test the preview endpoint functionality."""

    @patch('users.api.vendor_cases.get_speech_service')
    def test_preview_success(self, mock_get_service):
        """Test successful preview with mocked speech service."""
        # Setup mock
        mock_service = MagicMock()
        mock_service.process_audio.return_value = MockTranscriptionResult()
        mock_get_service.return_value = mock_service

        token = self.login_as_vendor()
        audio_file = self.create_test_audio_file()

        response = self.client.post(
            f'/api/vendor-check-statement-audio-preview/{self.case_id}/claimant',
            {'audio': audio_file},
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get('success'))
        self.assertIn('transcript_mr', data)
        self.assertIn('translation_en', data)
        self.assertIn('audit_id', data)

    @patch('users.api.vendor_cases.get_speech_service')
    def test_preview_creates_audit_record(self, mock_get_service):
        """Test that preview creates an audit record."""
        mock_service = MagicMock()
        mock_service.process_audio.return_value = MockTranscriptionResult()
        mock_get_service.return_value = mock_service

        token = self.login_as_vendor()
        audio_file = self.create_test_audio_file()

        response = self.client.post(
            f'/api/vendor-check-statement-audio-preview/{self.case_id}/claimant',
            {'audio': audio_file},
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        audit_id = data.get('audit_id')

        # Verify audit record exists
        with connections['default'].cursor() as cursor:
            cursor.execute(
                "SELECT is_applied_to_check, source FROM statement_audio_audit WHERE id = %s",
                [audit_id]
            )
            row = cursor.fetchone()
            self.assertIsNotNone(row)
            self.assertFalse(row[0])  # is_applied_to_check should be False
            self.assertEqual(row[1], 'audio_preview')


class TestApplyEndpoint(VendorStatementTestCase):
    """Test the apply endpoint functionality."""

    @patch('users.api.vendor_cases.get_speech_service')
    def test_apply_success_claimant(self, mock_get_service):
        """Test successful apply to claimant check statement."""
        mock_service = MagicMock()
        mock_service.process_audio.return_value = MockTranscriptionResult(
            translation_en="This is the translated statement."
        )
        mock_get_service.return_value = mock_service

        token = self.login_as_vendor()
        audio_file = self.create_test_audio_file()

        response = self.client.post(
            f'/api/vendor-check-statement-audio-apply/{self.case_id}/claimant',
            {'audio': audio_file},
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get('success'))
        self.assertEqual(data.get('applied_to_column'), 'statement')

        # Verify statement was updated
        with connections['default'].cursor() as cursor:
            cursor.execute(
                "SELECT statement FROM claimant_checks WHERE id = %s",
                [self.check_id]
            )
            row = cursor.fetchone()
            self.assertEqual(row[0], "This is the translated statement.")


class TestSpotCheckObservations(VendorStatementTestCase):
    """Test that spot check writes to observations column."""

    def setUp(self):
        """Set up spot check for this test."""
        super().setUp()

        # Create a spot check assigned to our vendor
        with connections['default'].cursor() as cursor:
            cursor.execute("""
                INSERT INTO spot_checks (
                    case_id, assigned_vendor_id, check_status,
                    place_of_accident, district
                ) VALUES (
                    %s, %s, 'WIP', 'Test Location', 'Test District'
                )
                ON CONFLICT DO NOTHING
                RETURNING id
            """, [self.case_id, self.vendor.id])
            row = cursor.fetchone()
            if row:
                self.spot_check_id = row[0]
            else:
                cursor.execute("""
                    SELECT id FROM spot_checks
                    WHERE case_id = %s AND assigned_vendor_id = %s
                """, [self.case_id, self.vendor.id])
                row = cursor.fetchone()
                self.spot_check_id = row[0] if row else None

    def tearDown(self):
        """Clean up spot check."""
        with connections['default'].cursor() as cursor:
            cursor.execute("DELETE FROM spot_checks WHERE case_id = %s", [self.case_id])
        super().tearDown()

    @patch('users.api.vendor_cases.get_speech_service')
    def test_apply_spot_writes_to_observations(self, mock_get_service):
        """Test that apply to spot check writes to observations column, not statement."""
        mock_service = MagicMock()
        mock_service.process_audio.return_value = MockTranscriptionResult(
            translation_en="Spot observation text."
        )
        mock_get_service.return_value = mock_service

        token = self.login_as_vendor()
        audio_file = self.create_test_audio_file()

        response = self.client.post(
            f'/api/vendor-check-statement-audio-apply/{self.case_id}/spot',
            {'audio': audio_file},
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get('success'))
        self.assertEqual(data.get('applied_to_column'), 'observations')

        # Verify observations was updated
        with connections['default'].cursor() as cursor:
            cursor.execute(
                "SELECT observations FROM spot_checks WHERE id = %s",
                [self.spot_check_id]
            )
            row = cursor.fetchone()
            self.assertEqual(row[0], "Spot observation text.")


class TestManualTextApply(VendorStatementTestCase):
    """Test the manual text apply endpoint."""

    def test_manual_text_apply_success(self):
        """Test successful manual text apply."""
        token = self.login_as_vendor()
        payload = {
            'edited_english_text': 'This is manually edited statement text.',
            'transcript_mr': 'मराठी मजकूर',
        }

        response = self.client.post(
            f'/api/vendor-check-statement-text-apply/{self.case_id}/claimant',
            json.dumps(payload),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get('success'))
        self.assertEqual(data.get('applied_to_column'), 'statement')

        # Verify statement was updated
        with connections['default'].cursor() as cursor:
            cursor.execute(
                "SELECT statement FROM claimant_checks WHERE id = %s",
                [self.check_id]
            )
            row = cursor.fetchone()
            self.assertEqual(row[0], 'This is manually edited statement text.')

    def test_manual_text_apply_empty_rejected(self):
        """Test that empty text is rejected."""
        token = self.login_as_vendor()
        payload = {
            'edited_english_text': '   ',
            'transcript_mr': '',
        }

        response = self.client.post(
            f'/api/vendor-check-statement-text-apply/{self.case_id}/claimant',
            json.dumps(payload),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )

        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('required', data.get('error', '').lower())


class TestNonRegression(VendorStatementTestCase):
    """Non-regression tests for existing functionality."""

    def test_evidence_upload_still_works(self):
        """Test that existing evidence upload endpoint still works."""
        token = self.login_as_vendor()

        # Create a fake image file
        image_content = b'FAKE_IMAGE_CONTENT'
        image_file = io.BytesIO(image_content)
        image_file.name = 'test_image.jpg'

        response = self.client.post(
            f'/api/vendor-check-upload/{self.case_id}/claimant',
            {'photos': image_file},
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )

        # Should work (might fail due to image validation, but shouldn't 500)
        self.assertIn(response.status_code, [200, 400])

    def test_vendor_check_detail_still_works(self):
        """Test that existing check detail endpoint still works."""
        token = self.login_as_vendor()

        response = self.client.get(
            f'/api/vendor-check-detail/{self.case_id}/claimant',
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('case', data)
        self.assertIn('check', data)


class TestTranscriptColumnPersistence(VendorStatementTestCase):
    """Test that transcript columns are properly persisted."""

    @patch('users.api.vendor_cases.get_speech_service')
    def test_transcript_columns_populated(self, mock_get_service):
        """Test that all transcript columns are populated after apply."""
        mock_service = MagicMock()
        mock_service.process_audio.return_value = MockTranscriptionResult(
            transcript_mr="मराठी मजकूर",
            translation_en="English translation",
            detected_language="mr",
            confidence=0.95,
        )
        mock_get_service.return_value = mock_service

        token = self.login_as_vendor()
        audio_file = self.create_test_audio_file()

        response = self.client.post(
            f'/api/vendor-check-statement-audio-apply/{self.case_id}/claimant',
            {'audio': audio_file},
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )

        self.assertEqual(response.status_code, 200)

        # Verify all transcript columns are populated
        with connections['default'].cursor() as cursor:
            cursor.execute("""
                SELECT
                    statement_transcript_mr,
                    statement_transcript_en,
                    statement_transcript_provider,
                    statement_transcript_confidence,
                    statement_transcript_updated_at
                FROM claimant_checks
                WHERE id = %s
            """, [self.check_id])
            row = cursor.fetchone()

            self.assertEqual(row[0], "मराठी मजकूर")
            self.assertEqual(row[1], "English translation")
            self.assertEqual(row[2], "groq")
            self.assertAlmostEqual(float(row[3]), 0.95, places=2)
            self.assertIsNotNone(row[4])  # updated_at should be set
